/* Atribuicao do site e sinais de intencao para o ChatGPT Ads.
   Mantem a origem entre www.sirfisher.com.br e reservas.sirfisher.com.br,
   decora os links de reserva e mede acoes sem confundi-las com uma visita. */
(function () {
  'use strict';

  var STORAGE_KEY = 'sf_attribution_v1';
  var COOKIE_KEY = 'sf_attribution_v1';
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
      return parsed && typeof parsed === 'object' ? parsed : null;
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
    return parseStored(local) || parseStored(readCookie(COOKIE_KEY)) || {};
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
    document.cookie = COOKIE_KEY + '=' + encodeURIComponent(value) +
      '; Max-Age=7776000; Path=/' + domain + '; SameSite=Lax' + secure;
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
      var current = Object.assign({}, stored, incoming, {
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
