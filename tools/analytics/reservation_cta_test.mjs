// deno test --allow-read tools/analytics/reservation_cta_test.mjs
// Executa os handlers reais com tags/rede ausentes; nao envia eventos nem reservas.
const pages = ['index.html', 'en/index.html', 'conheca/index.html', 'almoco-executivo/index.html',
  'como-chegar/index.html', 'fish-and-chips/index.html', 'en/fish-and-chips/index.html',
  'guia/beira-mar/index.html', 'jardim-japones/index.html', 'por-do-sol/index.html', 'reservas/index.html',
  'reveillon/index.html'];
const read = (path) => Deno.readTextFile(new URL('../../' + path, import.meta.url));
const source = await read('assets/js/atribuicao.js');
const cardapio = await read('assets/js/cardapio.js');
const cardapioEn = await read('assets/js/cardapio-en.js');
const positions = new Set(['topo', 'abertura', 'reservas', 'visita', 'cardapio_rodape', 'conteudo']);
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function linkFromTag(tag) {
  const attrs = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2].replaceAll('&amp;', '&')]));
  return { href: attrs.href, textContent: 'Reservar mesa', nodeType: 1,
    getAttribute(name) { return attrs[name] ?? null; },
    hasAttribute(name) { return name in attrs; },
    closest() { return null; } };
}

function attribution(links, { search = '', blocked = false } = {}) {
  let mutation;
  const listeners = [];
  const document = { cookie: '', title: 'Sir Fisher', referrer: '', documentElement: {},
    querySelectorAll() { return links; }, addEventListener(...args) { listeners.push(args); } };
  const window = { oaiq() {},
    location: { search, href: 'https://www.sirfisher.com.br/' + search, pathname: '/',
      hostname: 'www.sirfisher.com.br', protocol: 'https:' },
    localStorage: { getItem() { if (blocked) throw new Error('blocked'); return null; },
      setItem() { if (blocked) throw new Error('blocked'); } },
    MutationObserver: class { constructor(callback) { mutation = callback; } observe() {} } };
  new Function('window', 'document', 'MutationObserver', source)(window, document, window.MutationObserver);
  return { mutation, listeners };
}

for (const page of pages) {
  const html = await read(page);
  const tags = [...html.matchAll(/<a\b[^>]*\bdata-evt="[^"]+"[^>]*>/g)].map((m) => m[0]);
  const handler = html.match(/document\.addEventListener\('click', function \(e\) \{\s*var a = e\.target\.closest[\s\S]*?\}, \{ passive: true \}\);/);
  assert(handler, page + ': handler de clique ausente');

  Deno.test(page + ': posicoes explicitas e contexto no primeiro clique, mesmo sem JS', () => {
    for (const tag of tags) {
      const link = linkFromTag(tag);
      const position = link.getAttribute('data-position');
      assert(/^[a-z_]{1,40}$/.test(position || ''), page + ': posicao ausente/invalida');
      if (link.getAttribute('data-evt') !== 'click_reservation') continue;
      const url = new URL(link.href);
      assert(url.origin === 'https://reservas.sirfisher.com.br' && url.pathname === '/', 'Destino alterado');
      assert(positions.has(position) && url.searchParams.get('sf_cta') === position, 'Contexto depende de script tardio');
      assert(!url.searchParams.has('utm_source'), 'CTA criou campanha sintetica');
      if (page.startsWith('en/')) assert(url.searchParams.get('lang') === 'en', 'Idioma perdido');
    }
  });

  Deno.test(page + ': handler real envia uma vez o evento existente com posicao', () => {
    const listeners = [];
    const calls = [];
    const window = { dataLayer: [], gtag(...args) { calls.push(args); } };
    const document = { addEventListener(...args) { listeners.push(args); } };
    new Function('window', 'document', handler[0])(window, document);
    assert(listeners.length === 1 && listeners[0][2].passive, 'Navegacao precisa permanecer passiva');
    for (const tag of tags) {
      const link = linkFromTag(tag);
      listeners[0][1]({ target: { closest() { return link; } } });
      const [kind, name, payload] = calls.at(-1);
      assert(kind === 'event' && name === link.getAttribute('data-evt'), 'Nome do evento alterado');
      assert(payload.cta_position === link.getAttribute('data-position'), 'Posicao perdida no GA4');
      assert(payload.link_url === link.href, 'Destino alterado pelo handler');
    }
    assert(calls.length === tags.length && window.dataLayer.length === tags.length, 'Evento duplicado');
  });

  Deno.test(page + ': sem gtag/Meta enfileira clique e preserva navegacao', () => {
    let listener;
    const window = { dataLayer: [] };
    const document = { addEventListener(name, callback) { listener = callback; } };
    new Function('window', 'document', handler[0])(window, document);
    const link = linkFromTag(tags[0]);
    const before = link.href;
    listener({ target: { closest() { return link; } }, preventDefault() { throw new Error('Navegacao bloqueada'); } });
    listener({ target: {} });
    assert(window.dataLayer.length === 1 && link.href === before, 'Tag ausente quebrou o clique');
  });
}

Deno.test('decoracao real preserva campanha, idioma, origem e ancora sem promover sf_cta a campanha', () => {
  const link = linkFromTag('<a href="https://reservas.sirfisher.com.br/?lang=en&amp;sf_origin=conheca#formulario" data-evt="click_reservation" data-position="abertura">');
  attribution([link], { search: '?utm_source=ig&utm_medium=social&utm_campaign=outubro&sf_cta=nao_herdar', blocked: true });
  const url = new URL(link.href);
  for (const [key, expected] of Object.entries({ lang: 'en', sf_origin: 'conheca', sf_cta: 'abertura', utm_source: 'ig', utm_medium: 'social', utm_campaign: 'outubro' })) {
    assert(url.searchParams.get(key) === expected, key + ' perdido/alterado');
  }
  assert(url.hash === '#formulario', 'Ancora perdida');
});

Deno.test('sf_cta nao se espalha para WhatsApp, Maps, porta, credencial, hostname falso ou Reveillon', () => {
  const destinations = ['https://api.whatsapp.com/send?phone=5585988544274',
    'https://www.google.com/maps/dir/?api=1', 'https://reservas.sirfisher.com.br.evil.test/',
    'https://reservas.sirfisher.com.br:8443/', 'https://user@reservas.sirfisher.com.br/',
    'http://reservas.sirfisher.com.br/', 'https://reservas.sirfisher.com.br/reveillon.html#mapa'];
  const links = destinations.map((href) => linkFromTag('<a href="' + href + '" data-evt="click_reservation" data-position="abertura">'));
  attribution(links);
  links.forEach((link, i) => assert(link.href === destinations[i], 'Destino alheio modificado: ' + destinations[i]));
});

Deno.test('callback de DOM decora reserva inserida depois, sem repetir campanha', () => {
  const { mutation } = attribution([]);
  const link = linkFromTag('<a href="https://reservas.sirfisher.com.br/?lang=en" data-evt="click_reservation" data-position="cardapio_rodape">');
  link.matches = () => true;
  link.parentNode = { querySelectorAll() { return [link]; } };
  mutation([{ addedNodes: [link] }]);
  const url = new URL(link.href);
  assert(url.searchParams.get('sf_cta') === 'cardapio_rodape' && url.searchParams.get('lang') === 'en', 'CTA dinamico sem contexto');
  assert(!url.searchParams.has('utm_source'), 'Inventou campanha');
});

function runCardapio(en, gtag) {
  const listeners = [];
  const nodes = new Map();
  const node = (key) => {
    if (!nodes.has(key)) nodes.set(key, { style: {}, addEventListener() {} });
    return nodes.get(key);
  };
  const document = { readyState: 'loading', documentElement: { getAttribute() { return en ? 'en' : 'pt'; } },
    querySelector(selector) { return node(selector); }, querySelectorAll() { return []; },
    addEventListener(name, callback) { listeners.push([name, callback]); } };
  const window = { gtag, addEventListener() {} };
  new Function('window', cardapioEn)(window);
  // Exporta somente no codigo avaliado pelo teste; o bundle publicado fica intacto.
  const instrumented = cardapio.replace('  if (document.readyState',
    '  window.testCTA = { ligar: ligarControles, rodape: desenharRodape };\n  if (document.readyState');
  new Function('window', 'document', 'setTimeout', instrumented)(window, document, () => {});
  window.testCTA.ligar();
  window.testCTA.rodape();
  return { window, listeners, html: node('#rodape').innerHTML };
}

for (const en of [false, true]) {
  Deno.test('cardapio ' + (en ? 'EN' : 'PT') + ': rodape real preserva idioma e mede CTA sem tag', () => {
    const s = runCardapio(en);
    const tag = s.html.match(/<a\b[^>]*data-evt="click_reservation"[^>]*>/)[0];
    const link = linkFromTag(tag);
    const url = new URL(link.href);
    assert(url.searchParams.get('sf_cta') === 'cardapio_rodape', 'Rodape sem contexto');
    assert(url.searchParams.get('lang') === (en ? 'en' : null), 'Idioma alterado');
    const event = { target: { closest(selector) { return selector === 'a' ? link : null; } } };
    s.listeners.filter(([name]) => name === 'click').forEach(([, callback]) => callback(event));
    assert(s.window.dataLayer.length === 1 && s.window.dataLayer[0].event === 'click_reservation', 'Clique perdido/duplicado');
    assert(s.window.dataLayer[0].cta_position === 'cardapio_rodape', 'GA4 perdeu posicao');
  });
}

Deno.test('falha da tag nao interrompe sinal nem clique no cardapio', () => {
  const s = runCardapio(false, () => { throw new Error('tag indisponivel'); });
  const link = linkFromTag(s.html.match(/<a\b[^>]*data-evt="click_reservation"[^>]*>/)[0]);
  const event = { target: { closest(selector) { return selector === 'a' ? link : null; } } };
  s.listeners.filter(([name]) => name === 'click').forEach(([, callback]) => callback(event));
  assert(s.window.dataLayer[0].cta_position === 'cardapio_rodape', 'Falha de tag impediu fila');
});
