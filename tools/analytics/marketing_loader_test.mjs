// deno test tools/analytics/marketing_loader_test.mjs
const PAGINAS = ['index.html', 'en/index.html', 'conheca/index.html', 'almoco-executivo/index.html',
  'cardapio/index.html', 'como-chegar/index.html', 'en/fish-and-chips/index.html', 'fish-and-chips/index.html',
  'guia/beira-mar/index.html', 'por-do-sol/index.html', 'reservas/index.html', 'reveillon/index.html']
  .map((p) => '../../' + p);

async function blocoMarketing(pagina) {
  const html = await Deno.readTextFile(new URL(pagina, import.meta.url));
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1])
    .filter((s) => /sfAfterFirstPaint|gtag\('config'|fbq\('init'/.test(s))
    .join('\n');
}

function setup(block, readyState = 'loading') {
  const listeners = new Map();
  const timers = [];
  const scripts = [];
  const dataLayer = [];
  const window = {
    dataLayer,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
  };
  const document = {
    readyState,
    createElement() { return {}; },
    head: { appendChild(script) { scripts.push(script.src); } },
    getElementsByTagName() { return [{ parentNode: { insertBefore(script) { scripts.push(script.src); } } }]; },
  };
  const setTimeout = (callback, ms) => { const t = { callback, ms, ativo: true }; timers.push(t); return t; };
  const clearTimeout = (t) => { if (t) t.ativo = false; };
  new Function('window', 'document', 'setTimeout', 'clearTimeout', 'fbq', 'dataLayer', block)(
    window, document, setTimeout, clearTimeout, (...args) => window.fbq(...args), dataLayer);
  const disparar = (ms) => timers.filter((t) => t.ativo && t.ms === ms).forEach((t) => { t.ativo = false; t.callback(); });
  return { listeners, timers, scripts, window, dataLayer, disparar };
}

for (const pagina of PAGINAS) {
  const block = await blocoMarketing(pagina);

  // O cardapio nao tem o Pixel da Meta: so o gtag entra.
  const pixel = block.includes("fbq('init'");
  const sdks = pixel ? 2 : 1;

  Deno.test(`${pagina}: enfileira eventos e so baixa SDKs 7 s depois do load`, () => {
    const s = setup(block);
    if (s.scripts.length) throw new Error('SDK baixado antes do load');
    if (s.dataLayer.length !== 2 || (pixel && s.window.fbq.queue.length !== 2)) throw new Error('Perdeu a fila inicial');
    s.listeners.get('load')();
    if (s.scripts.length) throw new Error('SDK baixado junto com o load');
    s.disparar(7000);
    if (s.scripts.length !== sdks) throw new Error(`Esperava ${sdks} SDK(s), veio ${s.scripts}`);
    s.disparar(15000);
    if (s.scripts.length !== sdks) throw new Error('SDK duplicado');
  });

  Deno.test(`${pagina}: primeira interacao antecipa os SDKs sem duplicar`, () => {
    const s = setup(block);
    if (pixel) s.window.fbq('track', 'Contact');
    s.listeners.get('touchstart')();
    if (s.scripts.length !== sdks || (pixel && s.window.fbq.queue.length !== 3)) throw new Error('Perdeu evento ou nao carregou');
    s.listeners.get('load')?.();
    s.disparar(7000);
    s.disparar(15000);
    if (s.scripts.length !== sdks) throw new Error('SDK duplicado');
  });

  Deno.test(`${pagina}: teto carrega SDKs mesmo sem load`, () => {
    const s = setup(block);
    s.disparar(15000);
    if (s.scripts.length !== sdks) throw new Error('SDK permaneceu bloqueado');
  });

  Deno.test(`${pagina}: carregador pedido depois de pronto roda na hora`, () => {
    const s = setup(block, 'complete');
    s.disparar(7000);
    let rodou = false;
    s.window.sfAfterFirstPaint(() => { rodou = true; });
    if (!rodou) throw new Error('atribuicao.js ficaria sem o pixel');
  });
}
