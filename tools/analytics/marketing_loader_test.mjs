// deno test tools/analytics/marketing_loader_test.mjs
const PAGINAS = ['../../index.html', '../../en/index.html', '../../conheca/index.html'];

async function blocoMarketing(pagina) {
  const html = await Deno.readTextFile(new URL(pagina, import.meta.url));
  const head = html.slice(0, html.indexOf('</head>'));
  return [...head.matchAll(/<script>([\s\S]*?)<\/script>/g)]
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

  Deno.test(`${pagina}: enfileira eventos e so baixa SDKs 4 s depois do load`, () => {
    const s = setup(block);
    if (s.scripts.length) throw new Error('SDK baixado antes do load');
    if (s.window.fbq.queue.length !== 2 || s.dataLayer.length !== 2) throw new Error('Perdeu a fila inicial');
    s.listeners.get('load')();
    if (s.scripts.length) throw new Error('SDK baixado junto com o load');
    s.disparar(4000);
    if (s.scripts.length !== 2) throw new Error(`Esperava gtag e Pixel, veio ${s.scripts}`);
    s.disparar(15000);
    if (s.scripts.length !== 2) throw new Error('SDK duplicado');
  });

  Deno.test(`${pagina}: primeira interacao antecipa os SDKs sem duplicar`, () => {
    const s = setup(block);
    s.window.fbq('track', 'Contact');
    s.listeners.get('touchstart')();
    if (s.scripts.length !== 2 || s.window.fbq.queue.length !== 3) throw new Error('Perdeu evento ou nao carregou');
    s.listeners.get('load')?.();
    s.disparar(4000);
    s.disparar(15000);
    if (s.scripts.length !== 2) throw new Error('SDK duplicado');
  });

  Deno.test(`${pagina}: teto carrega SDKs mesmo sem load`, () => {
    const s = setup(block);
    s.disparar(15000);
    if (s.scripts.length !== 2) throw new Error('SDK permaneceu bloqueado');
  });

  Deno.test(`${pagina}: carregador pedido depois de pronto roda na hora`, () => {
    const s = setup(block, 'complete');
    s.disparar(4000);
    let rodou = false;
    s.window.sfAfterFirstPaint(() => { rodou = true; });
    if (!rodou) throw new Error('atribuicao.js ficaria sem o pixel');
  });
}
