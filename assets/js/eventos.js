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

  function validateStep() {
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

  function savings(option) {
    var menu = Number(option.menuValueTotal) || 0;
    if (!menu || option.total >= menu) return '';
    var pct = Math.round((1 - option.total / menu) * 100);
    return '<em class="option-savings">' + pct + '% abaixo do cardápio <s>' + money.format(menu) + '</s></em>';
  }

  function optionCard(option, index) {
    var items = (option.menuItems || option.mainFoods.map(function (name) { return { name: name, detail: '' }; }))
      .map(function (item) { return '<li><strong>' + esc(item.name) + '</strong>' + (item.detail ? '<span>' + esc(item.detail) + '</span>' : '') + '</li>'; }).join('');
    var additions = option.additions.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('');
    var notIncluded = option.notIncluded.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('');
    var label = option.exact ? 'Pré-proposta' : 'Validação necessária';
    var tier = String(option.name).split(' · ').pop();
    return '<article class="option-card' + (index === 1 ? ' is-featured' : '') + '" data-option="' + esc(option.id) + '">' +
      '<div class="option-top"><span class="option-tier">' + esc(tier) + '</span><span class="risk-chip risk-chip--' + esc(option.riskLevel) + '">' + label + '</span></div>' +
      '<h3>' + esc(option.name) + '</h3>' +
      (option.summary ? '<p class="option-summary">' + esc(option.summary) + '</p>' : '') +
      '<ul class="option-items">' + items + '</ul>' +
      '<div class="option-drinks"><strong>' + esc(option.beverageLabel) + '</strong>' + (option.beverageDetail ? '<span>' + esc(option.beverageDetail) + '</span>' : '') + '</div>' +
      '<p class="option-duration">' + esc(option.durationHours) + ' horas de evento</p>' +
      '<div class="option-price"><strong>' + money.format(option.pricePerPerson) + '</strong><small>por pessoa</small><span>' + money.format(option.total) + ' no total</span>' + savings(option) + '</div>' +
      '<p class="service-note">Atendimento incluído. ' + esc(option.validationMessage) + '</p>' +
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
