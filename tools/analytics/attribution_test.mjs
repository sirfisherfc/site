const source = await Deno.readTextFile(new URL('../../assets/js/atribuicao.js', import.meta.url));
const NOW = Date.parse('2026-10-25T12:00:00Z');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])); }
  static now() { return NOW; }
}

function run({ search = '', stored = null, cookieStored = stored, blocked = false, details = false } = {}) {
  let written = null;
  const link = { href: 'https://reservas.sirfisher.com.br/reveillon.html?utm_source=site&utm_medium=organic&utm_content=por_do_sol#mapa' };
  const document = {
    cookie: cookieStored ? 'sf_attribution_v1=' + encodeURIComponent(JSON.stringify(cookieStored)) : '',
    title: 'Sir Fisher', referrer: 'https://www.google.com/',
    querySelectorAll() { return [link]; }, addEventListener() {},
  };
  const window = {
    location: { search, href: 'https://www.sirfisher.com.br/por-do-sol/' + search,
      pathname: '/por-do-sol/', hostname: 'www.sirfisher.com.br', protocol: 'https:' },
    localStorage: { getItem() { if (blocked) throw new Error('blocked'); return stored && JSON.stringify(stored); }, setItem(_key, value) { written = JSON.parse(value); } },
    oaiq() {},
  };
  new Function('window', 'document', 'Date', source)(window, document, Clock);
  const url = new URL(link.href);
  return details ? { url, written, cookie: document.cookie } : url;
}

Deno.test('navegacao interna remove campanha site e preserva contexto e ancora', () => {
  const url = run();
  if (url.searchParams.has('utm_source') || url.searchParams.has('utm_medium')) throw new Error('Inventou uma campanha interna');
  if (url.searchParams.get('sf_origin') !== 'por_do_sol' || url.hash !== '#mapa') throw new Error('Perdeu contexto da reserva');
});

Deno.test('campanha paga segue para o portal com sua origem e identificador', () => {
  const url = run({ search: '?utm_source=chatgpt&utm_medium=paid&oppref=example-reference' });
  if (url.searchParams.get('utm_source') !== 'chatgpt' || url.searchParams.get('utm_medium') !== 'paid') throw new Error('Campanha paga foi substituida');
  if (url.searchParams.get('oppref') !== 'example-reference') throw new Error('Perdeu atribuicao do anuncio');
});

Deno.test('cookie compartilhado preserva Instagram com storage bloqueado', () => {
  const url = run({ blocked: true, stored: { utm_source: 'ig', utm_medium: 'social', captured_at: '2026-10-06T12:00:00Z' } });
  if (url.searchParams.get('utm_source') !== 'ig' || url.searchParams.get('utm_medium') !== 'social') throw new Error('Origem compartilhada perdida');
});

Deno.test('campanha interna legada no cookie nao volta ao link', () => {
  const url = run({ stored: { utm_source: 'site', utm_medium: 'organic', captured_at: '2026-10-06T12:00:00Z' } });
  if (url.searchParams.has('utm_source') || url.searchParams.has('utm_medium')) throw new Error('Reintroduziu campanha interna');
});

Deno.test('nova origem nao herda clique nem identificadores da campanha anterior', () => {
  const url = run({ search: '?utm_source=google&utm_medium=cpc&utm_campaign=nova', stored: {
    utm_source: 'chatgpt', utm_medium: 'paid', utm_campaign: 'antiga',
    oppref: 'old-click', campaign_id: 'old-campaign', ad_id: 'old-ad', fbclid: 'old-meta',
    captured_at: '2026-10-06T12:00:00Z',
  } });
  if (url.searchParams.get('utm_source') !== 'google') throw new Error('Perdeu nova origem');
  for (const key of ['oppref', 'campaign_id', 'ad_id', 'fbclid']) {
    if (url.searchParams.has(key)) throw new Error('Herdou identificador: ' + key);
  }
});

Deno.test('cookie atualizado no portal prevalece sobre storage antigo do site', () => {
  const url = run({
    stored: { utm_source: 'chatgpt', oppref: 'old-click', captured_at: '2026-10-06T12:00:00Z' },
    cookieStored: { utm_source: 'instagram', captured_at: '2026-10-13T12:00:00Z' },
  });
  if (url.searchParams.get('utm_source') !== 'instagram' || url.searchParams.has('oppref')) {
    throw new Error('Storage antigo ressuscitou origem anterior');
  }
});

Deno.test('atribuicao expirada nao ressuscita do localStorage nem do cookie', () => {
  const old = { utm_source: 'instagram', captured_at: new Date(NOW - 90 * 86400000).toISOString() };
  const result = run({ stored: old, details: true });
  if (result.url.searchParams.has('utm_source') || result.written.utm_source) throw new Error('Origem expirada foi propagada');
  if (Date.parse(result.written.captured_at) !== NOW) throw new Error('Nao capturou a entrada atual sem origem inventada');
});

Deno.test('data ausente, invalida ou futura nao comprova origem armazenada', () => {
  for (const captured_at of [undefined, 'invalid', new Date(NOW + 86400000).toISOString()]) {
    if (run({ stored: { utm_source: 'instagram', captured_at } }).searchParams.has('utm_source')) throw new Error('Aceitou data sem validade');
  }
});

Deno.test('cookie valido prevalece sobre storage expirado', () => {
  const url = run({ stored: { utm_source: 'chatgpt', captured_at: '2000-01-01T00:00:00Z' },
    cookieStored: { utm_source: 'instagram', captured_at: new Date(NOW - 86400000).toISOString() } });
  if (url.searchParams.get('utm_source') !== 'instagram') throw new Error('Perdeu o cookie valido');
});

Deno.test('navegacao interna conserva idade e so grava o prazo restante do cookie', () => {
  const captured_at = new Date(NOW - 89 * 86400000).toISOString();
  const result = run({ search: '?utm_source=instagram', stored: { utm_source: 'instagram', captured_at }, details: true });
  if (result.written.captured_at !== captured_at || !result.cookie.includes('Max-Age=86400;')) throw new Error('Navegacao interna renovou a janela');
});

Deno.test('nova campanha apos expiracao recebe janela propria de 90 dias', () => {
  const result = run({ search: '?utm_source=instagram&utm_campaign=novo',
    stored: { utm_source: 'google', captured_at: '2000-01-01T00:00:00Z' }, details: true });
  if (result.written.utm_source !== 'instagram' || !result.cookie.includes('Max-Age=7776000;')) throw new Error('Nova campanha perdeu validade');
});
