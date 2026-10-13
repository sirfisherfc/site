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

function setup(block, readyState = 'loading', search = '') {
  const listeners = new Map();
  const timers = [];
  const scripts = [];
  const dataLayer = [];
  const frames = [];
  const window = {
    location: { search },
    requestAnimationFrame(callback) { frames.push(callback); },
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
  return { listeners, timers, scripts, window, dataLayer, disparar, frames };
}

const paidBlock = await blocoMarketing('../../conheca/index.html');
for (const search of ['?utm_source=chatgpt&utm_medium=paid', '?oppref=test-click']) {
  Deno.test(`pagina do anuncio: ${search} mede depois da pintura antes do load`, () => {
    const s = setup(paidBlock, 'loading', search);
    if (s.scripts.length) throw new Error('SDK antes da pintura');
    s.frames.shift()();
    if (s.scripts.length) throw new Error('SDK antes da primeira pintura');
    s.frames.shift()();
    if (s.scripts.length !== 2) throw new Error('Nao mediu trafego pago sem load');
    s.disparar(1000);
    if (s.scripts.length !== 2) throw new Error('SDK duplicado');
    let executed = false;
    s.window.sfAfterFirstPaint(() => { executed = true; });
    if (!executed) throw new Error('Pixel OpenAI tardio ficou bloqueado');
  });
}

Deno.test('pagina do anuncio: teto de 1 s mede campanha em aba sem animacao', () => {
  const s = setup(paidBlock, 'loading', '?utm_medium=cpc');
  s.disparar(1000);
  if (s.scripts.length !== 2) throw new Error('Campanha nao medida no teto');
  s.frames.shift()(); s.frames.shift()();
  if (s.scripts.length !== 2) throw new Error('SDK duplicado');
});

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
    s.listeners.get('touchstart')({ type: 'touchstart' });
    if (s.scripts.length !== sdks || (pixel && s.window.fbq.queue.length !== 3)) throw new Error('Perdeu evento ou nao carregou');
    s.listeners.get('load')?.();
    s.disparar(7000);
    s.disparar(15000);
    if (s.scripts.length !== sdks) throw new Error('SDK duplicado');
  });

  Deno.test(`${pagina}: pointermove sem deslocamento (sintetico) nao conta como interacao`, () => {
    const s = setup(block);
    s.listeners.get('pointermove')({ type: 'pointermove', movementX: 0, movementY: 0 });
    if (s.scripts.length) throw new Error('SDK baixado por pointermove sintetico');
    s.listeners.get('pointermove')({ type: 'pointermove', movementX: 3, movementY: 1 });
    if (s.scripts.length !== sdks) throw new Error('Movimento real do mouse nao carregou os SDKs');
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
