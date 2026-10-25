/* Atribuicao do site e sinais de intencao para o ChatGPT Ads.
   Mantem a origem entre www.sirfisher.com.br e reservas.sirfisher.com.br,
   decora os links de reserva e mede acoes sem confundi-las com uma visita. */
(function () {
  'use strict';

  var STORAGE_KEY = 'sf_attribution_v1';
  var COOKIE_KEY = 'sf_attribution_v1';
  var ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
  var PIXEL_ID = 'EeuuYrh8KtQu1TPmmwWctv';
  var tracked = [
    'oppref', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
    'campaign_id', 'ad_group_id', 'ad_id', 'fbclid', 'gclid'
  ];

  function readCookie(name) {
    var prefix = name + '=';
    var entries = document.cookie ? document.cookie.split('; ') : [];
    for (var i = 0; i < entries.length; i += 1) {
      if (entries[i].indexOf(prefix) !== 0) continue;
      try {
        return decodeURIComponent(entries[i].slice(prefix.length));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  function parseStored(raw) {
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
          typeof parsed.captured_at !== 'string') return null;
      var captured = Date.parse(parsed.captured_at);
      var age = Date.now() - captured;
      return Number.isFinite(captured) && captured > 0 && age >= 0 && age < ATTRIBUTION_TTL_MS
        ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function loadStored() {
    var local = null;
    try {
      local = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      // O navegador pode bloquear armazenamento local.
    }
    var localValue = parseStored(local);
    var sharedValue = parseStored(readCookie(COOKIE_KEY));
    // Cada dominio tem seu storage; o cookie pode ter uma campanha mais nova.
    if (!localValue) return sharedValue || {};
    if (!sharedValue) return localValue;
    return (Date.parse(sharedValue.captured_at) || 0) > (Date.parse(localValue.captured_at) || 0)
      ? sharedValue : localValue;
  }

  function persist(attribution) {
    var value = JSON.stringify(attribution);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {
      // O cookie compartilhado ainda pode preservar a origem.
    }

    var secure = window.location.protocol === 'https:' ? '; Secure' : '';
    var domain = window.location.hostname.endsWith('.sirfisher.com.br')
      ? '; Domain=.sirfisher.com.br'
      : '';
    var remaining = Math.max(0, Math.floor((Date.parse(attribution.captured_at) +
      ATTRIBUTION_TTL_MS - Date.now()) / 1000));
    document.cookie = COOKIE_KEY + '=' + encodeURIComponent(value) +
      '; Max-Age=' + remaining + '; Path=/' + domain + '; SameSite=Lax' + secure;
  }

  function limited(value, max) {
    var limit = max || 255;
    return typeof value === 'string' && value.length <= limit ? value : null;
  }

  function capture() {
    var params = new URLSearchParams(window.location.search);
    var incoming = {};
    tracked.forEach(function (key) {
      var value = limited(params.get(key), key === 'oppref' ? 1024 : 255);
      if (value) incoming[key] = value;
    });

    var stored = loadStored();
    if (stored.utm_source === 'site' && stored.utm_medium === 'organic') {
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
        delete stored[key];
      });
      persist(stored);
    }
    if (Object.keys(incoming).length) {
      if (Object.keys(incoming).every(function (key) { return incoming[key] === stored[key]; })) {
        // Um link interno decorado nao e um novo clique de anuncio.
        persist(stored);
        return stored;
      }
      // Novo toque: nao herda identificadores de outro canal ou campanha.
      var current = Object.assign({}, incoming, {
        landing_url: window.location.href.slice(0, 2000),
        referrer: (document.referrer || '').slice(0, 2000) || null,
        captured_at: new Date().toISOString()
      });
      persist(current);
      return current;
    }

    if (!stored.captured_at) {
      stored = {
        landing_url: window.location.href.slice(0, 2000),
        referrer: (document.referrer || '').slice(0, 2000) || null,
        captured_at: new Date().toISOString()
      };
      persist(stored);
    }
    return stored;
  }

  function decorateReservationLinks(attribution, root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('a[href^="https://reservas.sirfisher.com.br/"]').forEach(function (link) {
      var destination;
      try {
        destination = new URL(link.href);
      } catch (e) {
        return;
      }
      if (destination.protocol !== 'https:' || destination.hostname !== 'reservas.sirfisher.com.br' ||
          destination.port || destination.username || destination.password) return;

      // Posicao do botao e contexto da navegacao, nao uma nova campanha.
      // O Reveillon tem outro fluxo: nao recebe a posicao do formulario comum.
      var position = link.getAttribute ? link.getAttribute('data-position') : null;
      var eventName = link.getAttribute ? link.getAttribute('data-evt') : null;
      if (eventName === 'click_reservation' && /^\/(?:index\.html)?$/.test(destination.pathname) &&
          /^(topo|abertura|reservas|visita|cardapio_rodape|conteudo)$/.test(position || '')) {
        destination.searchParams.set('sf_cta', position);
      }

      // Um link interno não inicia uma campanha. Limpa os UTMs legados para
      // não transformar Google/Instagram em "site / organic" na reserva.
      if (destination.searchParams.get('utm_source') === 'site') {
        var origin = destination.searchParams.get('utm_content');
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
          destination.searchParams.delete(key);
        });
        if (origin) destination.searchParams.set('sf_origin', origin);
      }
      tracked.forEach(function (key) {
        var value = attribution[key];
        if (value) destination.searchParams.set(key, value);
      });
      link.href = destination.toString();
    });
  }

  function initOpenAIAdsPixel() {
    if (!PIXEL_ID || window.oaiq) return;
    var queue = function () { queue.q.push(arguments); };
    queue.q = [];
    window.oaiq = queue;

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://bzrcdn.openai.com/sdk/oaiq.min.js';
    if (typeof window.sfAfterFirstPaint === 'function') {
      window.sfAfterFirstPaint(function () { document.head.appendChild(script); });
    } else {
      document.head.appendChild(script);
    }
    window.oaiq('init', { pixelId: PIXEL_ID });
  }

  function measurePage() {
    if (typeof window.oaiq !== 'function') return;
    var path = window.location.pathname.replace(/^\/+|\/+$/g, '');
    var pageId = path ? 'sir_fisher_' + path.replace(/[^a-z0-9]+/gi, '_').toLowerCase() : 'sir_fisher_site';
    var pageName = path === 'cardapio' ? 'Cardapio Sir Fisher' : document.title.slice(0, 100);

    window.oaiq('measure', 'page_viewed', {
      type: 'contents',
      contents: [{ id: pageId, name: pageName, content_type: 'page' }]
    });

    if (path === 'cardapio') {
      window.oaiq('measure', 'custom', { type: 'custom' }, {
        custom_event_name: 'menu_opened'
      });
    }
  }

  function measureIntentClicks() {
    var events = {
      click_maps: 'directions_requested',
      click_whatsapp: 'whatsapp_started',
      click_phone: 'phone_call_started',
      click_reservation: 'reservation_started'
    };

    document.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a[data-evt]') : null;
      if (!link || typeof window.oaiq !== 'function') return;
      var customName = events[link.getAttribute('data-evt')];
      if (!customName) return;
      window.oaiq('measure', 'custom', { type: 'custom' }, {
        custom_event_name: customName
      });
    }, { passive: true });
  }

  var attribution = capture();
  decorateReservationLinks(attribution, document);

  if (window.MutationObserver) {
    new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches('a[href^="https://reservas.sirfisher.com.br/"]')) {
            decorateReservationLinks(attribution, node.parentNode || document);
          } else {
            decorateReservationLinks(attribution, node);
          }
        });
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  // A pagina de privacidade explica a medicao, mas nao e parte do funil pago.
  if (window.location.pathname.replace(/\/+$/, '') !== '/privacidade') {
    initOpenAIAdsPixel();
    measurePage();
    measureIntentClicks();
  }
})();
