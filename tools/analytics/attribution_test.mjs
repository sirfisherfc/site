const source = await Deno.readTextFile(new URL('../../assets/js/atribuicao.js', import.meta.url));
const NOW = Date.parse('2026-10-25T12:00:00Z');
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])); }
  static now() { return NOW; }
}

function run({ search = '', stored = null, cookieStored = stored, blocked = false, details = false,
  referrer = 'https://www.sirfisher.com.br/', consent = true } = {}) {
  let written = null;
  const link = { href: 'https://reservas.sirfisher.com.br/reveillon.html?utm_source=site&utm_medium=organic&utm_content=por_do_sol#mapa' };
  const document = {
    cookie: cookieStored ? 'sf_attribution_v1=' + encodeURIComponent(JSON.stringify(cookieStored)) : '',
    title: 'Sir Fisher', referrer,
    querySelectorAll() { return [link]; }, addEventListener() {},
  };
  const window = {
    sfGoogleAds: { getChoice: () => consent ? 'granted' : 'denied' },
    location: { search, href: 'https://www.sirfisher.com.br/por-do-sol/' + search,
      pathname: '/por-do-sol/', hostname: 'www.sirfisher.com.br', protocol: 'https:' },
    localStorage: { getItem() { if (blocked) throw new Error('blocked'); return stored && JSON.stringify(stored); }, setItem(_key, value) { written = JSON.parse(value); } },
    oaiq() {},
  };
  new Function('window', 'document', 'Date', source)(window, document, Clock);
  const url = new URL(link.href);
  return details ? { url, written, cookie: document.cookie } : url;
}

Deno.test('recusa preserva campanha estatistica e remove identificadores publicitarios', () => {
  const result = run({ consent: false, details: true,
    search: '?utm_source=google&utm_medium=cpc&gclid=private-click&oppref=private-reference',
    stored: { oppref: 'old', fbclid: 'old', captured_at: '2026-10-06T12:00:00Z' } });
  if (result.url.searchParams.get('utm_source') !== 'google') throw new Error('Perdeu estatistica');
  for (const key of ['gclid','fbclid','oppref']) {
    if (result.url.searchParams.has(key) || result.written[key]) throw new Error('Reteve clique sem consentimento');
  }
  if (result.written.landing_url.includes('?')) throw new Error('Persistiu parametros da pagina');
});

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

Deno.test('conteudo Meta e utm_id chegam ao portal sem perder identificadores explicitos', () => {
  const result = run({ search: '?utm_source=instagram&utm_medium=organic_social&utm_campaign=novembro&utm_content=ig_17900000000000000&utm_id=campanha-2026', details: true });
  for (const key of ['utm_content', 'utm_id', 'campaign_id']) {
    const expected = key === 'utm_content' ? 'ig_17900000000000000' : 'campanha-2026';
    if (result.url.searchParams.get(key) !== expected || result.written[key] !== expected) {
      throw new Error('Perdeu identificador: ' + key);
    }
  }
});

Deno.test('utm_id nao substitui campaign_id explicito e nao herda ID de campanha anterior', () => {
  const url = run({ search: '?utm_source=facebook&utm_id=ga-campaign&campaign_id=meta-campaign',
    stored: { utm_source: 'instagram', campaign_id: 'antiga', utm_id: 'antiga', captured_at: '2026-10-06T12:00:00Z' } });
  if (url.searchParams.get('campaign_id') !== 'meta-campaign' || url.searchParams.get('utm_id') !== 'ga-campaign') {
    throw new Error('Substituiu um identificador explicito');
  }
});

Deno.test('novo clique externo da mesma fonte nao herda conteudo, campanha ou anuncio anterior', () => {
  const result = run({ search: '?utm_source=instagram', referrer: 'https://l.instagram.com/', details: true,
    stored: { utm_source: 'instagram', utm_content: 'ig_17900000000000000', campaign_id: 'antiga',
      utm_id: 'antiga', ad_id: 'anuncio-antigo', fbclid: 'clique-antigo', captured_at: '2026-10-06T12:00:00Z' } });
  for (const key of ['utm_content', 'campaign_id', 'utm_id', 'ad_id', 'fbclid']) {
    if (result.url.searchParams.has(key) || result.written[key]) throw new Error('Herdou identificador: ' + key);
  }
  if (Date.parse(result.written.captured_at) !== NOW) throw new Error('Nao registrou nova chegada');
});

Deno.test('navegacao por subdominio proprio preserva conteudo e idade quando tags coincidem', () => {
  const captured_at = '2026-10-06T12:00:00Z';
  for (const referrer of ['https://sirfisher.com.br/', 'https://reservas.sirfisher.com.br/', '']) {
    const result = run({ search: '?utm_source=instagram', referrer, details: true,
      stored: { utm_source: 'instagram', utm_content: 'ig_17900000000000000', captured_at } });
    if (result.written.utm_content !== 'ig_17900000000000000' || result.written.captured_at !== captured_at) {
      throw new Error('Navegacao perdeu conteudo ou renovou prazo: ' + referrer);
    }
  }
});

Deno.test('hostname que apenas inclui o dominio proprio continua sendo chegada externa', () => {
  const result = run({ search: '?utm_source=instagram', referrer: 'https://sirfisher.com.br.example.com/', details: true,
    stored: { utm_source: 'instagram', utm_content: 'ig_antigo', captured_at: '2026-10-06T12:00:00Z' } });
  if (result.written.utm_content) throw new Error('Host externo foi tratado como navegacao interna');
});
