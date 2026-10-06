const source = await Deno.readTextFile(new URL('../../assets/js/atribuicao.js', import.meta.url));

function run({ search = '', stored = null, blocked = false } = {}) {
  const link = { href: 'https://reservas.sirfisher.com.br/reveillon.html?utm_source=site&utm_medium=organic&utm_content=por_do_sol#mapa' };
  const document = {
    cookie: stored ? 'sf_attribution_v1=' + encodeURIComponent(JSON.stringify(stored)) : '',
    title: 'Sir Fisher', referrer: 'https://www.google.com/',
    querySelectorAll() { return [link]; }, addEventListener() {},
  };
  const window = {
    location: { search, href: 'https://www.sirfisher.com.br/por-do-sol/' + search,
      pathname: '/por-do-sol/', hostname: 'www.sirfisher.com.br', protocol: 'https:' },
    localStorage: { getItem() { if (blocked) throw new Error('blocked'); return stored && JSON.stringify(stored); }, setItem() {} },
    oaiq() {},
  };
  new Function('window', 'document', source)(window, document);
  return new URL(link.href);
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
