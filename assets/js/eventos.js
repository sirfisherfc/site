(function () {
  'use strict';

  var ENDPOINT = 'https://lucpxoynpvogkvzepagi.supabase.co/functions/v1/event-quote';
  var form = document.getElementById('event-form');
  var contactForm = document.getElementById('contact-form');
  var steps = Array.from(document.querySelectorAll('.event-step'));
  var step = 1;
  var quote = null;
  var selectedOptionId = null;

  var money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var STEPS = 4;
  var stepNames = ['Data e horário', 'Convidados', 'Comida', 'Bebidas'];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char];
    });
  }

  function alertIn(id, message) {
    var node = document.getElementById(id);
    node.textContent = message || '';
    node.classList.remove('form-alert--info');
    node.hidden = !message;
  }

  function showStep(next) {
    step = Math.max(1, Math.min(STEPS, next));
    steps.forEach(function (node) { node.classList.toggle('is-active', Number(node.dataset.step) === step); });
    document.getElementById('step-label').textContent = 'Etapa ' + step + ' de ' + STEPS;
    document.getElementById('step-name').textContent = stepNames[step - 1];
    document.getElementById('progress-bar').style.width = (step * 100 / STEPS) + '%';
    document.getElementById('back-button').hidden = step === 1;
    document.getElementById('next-button').hidden = step === STEPS;
    document.getElementById('calculate-button').hidden = step !== STEPS;
    alertIn('form-alert', '');
    document.getElementById('configurator').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  var MIN_GUESTS = 30;
  var MAX_GUESTS = 100;

  function whatsapp(text) {
    return 'https://api.whatsapp.com/send?phone=5585988544274&text=' + encodeURIComponent(text);
  }

  function guestLimitMessage(guests) {
    if (guests && guests <= 10) {
      return '<strong>Para até 10 pessoas, é só reservar uma mesa.</strong> Sem orçamento nem pagamento antecipado: cada um pede o que quiser do cardápio. ' +
        '<br><a href="https://reservas.sirfisher.com.br/">Reservar mesa</a><a href="../cardapio/">Ver o cardápio</a>';
    }
    if (guests && guests < MIN_GUESTS) {
      return '<strong>Para ' + guests + ' pessoas, você não precisa de pacote.</strong> A gente junta as mesas para o grupo e cada um escolhe do cardápio, sem pagamento antecipado e sem risco de sobrar comida. ' +
        '<br><a href="' + whatsapp('Olá! Quero reservar mesas para um grupo de ' + guests + ' pessoas.') + '" target="_blank" rel="noopener">Reservar mesas pelo WhatsApp</a><a href="../cardapio/">Ver o cardápio</a>';
    }
    if (guests > MAX_GUESTS) {
      return '<strong>Montamos eventos de até ' + MAX_GUESTS + ' convidados sentados.</strong> Para grupos maiores ou eventos em pé, a equipe avalia o formato com você. ' +
        '<br><a href="' + whatsapp('Olá! Quero conversar sobre um evento com ' + guests + ' convidados.') + '" target="_blank" rel="noopener">Falar com a equipe pelo WhatsApp</a>';
    }
    return '';
  }

  function validateStep() {
    if (step === 2) {
      var limit = guestLimitMessage(Number(new FormData(form).get('guests') || 0));
      if (limit) {
        var node = document.getElementById('form-alert');
        node.innerHTML = limit;
        node.classList.add('form-alert--info');
        node.hidden = false;
        return false;
      }
    }
    var fields = Array.from(steps[step - 1].querySelectorAll('input,select'));
    for (var i = 0; i < fields.length; i++) {
      if (!fields[i].checkValidity()) {
        fields[i].reportValidity();
        return false;
      }
    }
    var data = new FormData(form);
    if (step === 2 && Number(data.get('children') || 0) > Number(data.get('guests') || 0)) {
      alertIn('form-alert', 'A quantidade de crianças não pode ser maior que o total de convidados.');
      return false;
    }
    return true;
  }

  function configuration() {
    var data = new FormData(form);
    return {
      date: data.get('date'), startTime: data.get('startTime'), durationHours: Number(data.get('durationHours')),
      guests: Number(data.get('guests')), children: Number(data.get('children') || 0),
      foodStyle: data.get('foodStyle'), beverageMode: data.get('beverageMode'), profile: 'comparar',
      dietaryRestriction: data.get('dietaryRestriction') === 'on', exclusive: false
    };
  }

  async function callApi(payload) {
    var response = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    var body = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(body.error || 'Não foi possível calcular agora.');
    return body;
  }

  function saving(option) {
    var menu = Number(option.menuValueTotal) || 0;
    if (!menu || option.total >= menu) return null;
    return { menu: menu, total: menu - option.total, perPerson: (menu - option.total) / Math.max(1, option.total / option.pricePerPerson), pct: Math.round((1 - option.total / menu) * 100) };
  }

  function savings(option) {
    var s = saving(option);
    if (!s) return '';
    var reference = Number(option.durationHours) > 3 ? 'no cardápio, com as horas extras' : 'pedindo os mesmos itens no cardápio';
    return '<div class="option-savings"><strong>Você economiza ' + money.format(s.total) + '</strong>' +
      '<span>' + money.format(s.perPerson) + ' a menos por pessoa · ' + reference + ' seria <s>' + money.format(s.menu) + '</s></span></div>';
  }

  function savingBadge(option) {
    var s = saving(option);
    return s ? '<span class="saving-chip">−' + s.pct + '% sobre o cardápio</span>' : '';
  }

  function optionCard(option, index) {
    var items = (option.menuItems || option.mainFoods.map(function (name) { return { name: name, detail: '' }; }))
      .map(function (item) { return '<li><strong>' + esc(item.name) + '</strong>' + (item.detail ? '<span>' + esc(item.detail) + '</span>' : '') + '</li>'; }).join('');
    var additions = option.additions.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('');
    var notIncluded = option.notIncluded.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('');
    var label = option.exact ? 'Pré-proposta' : 'Validação necessária';
    var tier = String(option.name).split(' · ').pop();
    return '<article class="option-card' + (index === 1 ? ' is-featured' : '') + '" data-option="' + esc(option.id) + '">' +
      '<div class="option-top"><span class="option-tier">' + esc(tier) + '</span>' + savingBadge(option) + '</div>' +
      '<h3>' + esc(option.name) + '</h3>' +
      (option.summary ? '<p class="option-summary">' + esc(option.summary) + '</p>' : '') +
      '<ul class="option-items">' + items + '</ul>' +
      '<div class="option-drinks"><strong>' + esc(option.beverageLabel) + '</strong>' + (option.beverageDetail ? '<span>' + esc(option.beverageDetail) + '</span>' : '') + '</div>' +
      '<p class="option-duration">' + esc(option.durationHours) + ' horas de evento</p>' +
      '<div class="option-price"><strong>' + money.format(option.pricePerPerson) + '</strong><small>por pessoa</small><span>' + money.format(option.total) + ' no total</span>' + savings(option) + '</div>' +
      '<p class="service-note">Atendimento incluído. <span class="risk-note risk-note--' + esc(option.riskLevel) + '">' + label + ':</span> ' + esc(option.validationMessage) + '</p>' +
      '<details><summary>Adicionais e o que não está incluído</summary>' +
      '<p><strong>Sob consulta</strong></p><ul>' + additions + '</ul>' +
      '<p><strong>Não incluído</strong></p><ul>' + notIncluded + '</ul></details>' +
      '<button class="select-option" type="button" data-select="' + esc(option.id) + '" data-tier="' + esc(tier) + '">Escolher ' + esc(tier) + '</button></article>';
  }

  function renderQuote(result) {
    quote = result;
    selectedOptionId = null;
    document.getElementById('option-grid').innerHTML = result.options.map(optionCard).join('');
    document.getElementById('availability-note').textContent = result.availabilityChecked
      ? 'Verificamos os dados operacionais disponíveis. A reserva só é confirmada depois da validação interna.'
      : 'A disponibilidade precisa ser conferida pela equipe antes de qualquer confirmação.';
    document.getElementById('results').hidden = false;
    contactForm.hidden = true;
    document.getElementById('success-card').hidden = true;
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.getElementById('next-button').addEventListener('click', function () { if (validateStep()) showStep(step + 1); });
  document.getElementById('back-button').addEventListener('click', function () { showStep(step - 1); });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!validateStep()) return;
    var button = document.getElementById('calculate-button');
    button.disabled = true; button.textContent = 'Calculando…'; alertIn('form-alert', '');
    try { renderQuote(await callApi({ action: 'quote', configuration: configuration() })); }
    catch (error) { alertIn('form-alert', error.message + ' Seus dados não foram enviados.'); }
    finally { button.disabled = false; button.textContent = 'Ver opções'; }
  });

  document.getElementById('option-grid').addEventListener('click', function (event) {
    var button = event.target.closest('[data-select]');
    if (!button) return;
    selectedOptionId = button.dataset.select;
    document.querySelectorAll('.option-card').forEach(function (card) { card.classList.toggle('is-selected', card.dataset.option === selectedOptionId); });
    document.querySelectorAll('[data-select]').forEach(function (item) { item.textContent = item.dataset.select === selectedOptionId ? 'Opção escolhida' : 'Escolher ' + item.dataset.tier; });
    contactForm.hidden = false;
    contactForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  contactForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!selectedOptionId || !quote) return;
    if (!contactForm.reportValidity()) return;
    var data = new FormData(contactForm);
    var config = configuration();
    config.exclusive = data.get('exclusive') === 'on';
    var button = contactForm.querySelector('.submit-button');
    button.disabled = true; button.textContent = 'Enviando…'; alertIn('contact-alert', '');
    try {
      var response = await callApi({
        action: 'submit', configuration: config, selectedOptionId: selectedOptionId,
        name: data.get('name'), phone: data.get('phone'), acceptedPrivacy: data.get('acceptedPrivacy') === 'on', website: data.get('website')
      });
      contactForm.hidden = true;
      var success = document.getElementById('success-card');
      success.innerHTML = '<h3>Recebemos sua configuração.</h3><p>Código <strong>' + esc(response.publicCode) + '</strong>. A equipe vai validar disponibilidade e condições antes de confirmar qualquer reserva.</p>' +
        (response.whatsappUrl ? '<a class="success-wa" href="' + esc(response.whatsappUrl) + '" target="_blank" rel="noopener">Falar agora com a equipe pelo WhatsApp</a>' : '');
      success.hidden = false;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) { alertIn('contact-alert', error.message); }
    finally { button.disabled = false; button.textContent = 'Enviar para validação'; }
  });

  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  form.elements.date.min = tomorrow.toISOString().slice(0, 10);
  form.elements.startTime.value = '18:00';
  showStep(1);
})();
