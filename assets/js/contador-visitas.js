/* Contador publico do site.
   Uma sessao recebe um UUID temporario no sessionStorage. Recarregar a pagina
   ou navegar pelo site reapresenta o mesmo UUID e nao aumenta o total. */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://lucpxoynpvogkvzepagi.supabase.co';
  var SUPABASE_ANON = 'sb_publishable_MrmIRQL5aE7yI_0Tu1jnmQ_CJKyDelF';
  var STORAGE_KEY = 'sf-visit-session';

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }

  var sessionId;
  try {
    sessionId = sessionStorage.getItem(STORAGE_KEY);
    if (!sessionId) {
      sessionId = newId();
      sessionStorage.setItem(STORAGE_KEY, sessionId);
    }
  } catch (e) {
    sessionId = newId();
  }

  fetch(SUPABASE_URL + '/rest/v1/rpc/register_site_visit', {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: 'Bearer ' + SUPABASE_ANON,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_session_id: sessionId })
  })
    .then(function (response) {
      if (!response.ok) throw new Error('visit counter unavailable');
      return response.json();
    })
    .then(function (total) {
      var counter = document.querySelector('[data-site-visits]');
      if (!counter || !Number.isFinite(Number(total))) return;
      counter.textContent = new Intl.NumberFormat('pt-BR').format(Number(total));
      counter.hidden = false;
    })
    .catch(function () {
      // O contador e decorativo; uma falha nunca interfere na pagina.
    });
})();
