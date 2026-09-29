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
  var stepNames = ['Data e horário', 'Convidados', 'Estilo de alimentação', 'Bebidas', 'Perfil da proposta'];

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
    step = Math.max(1, Math.min(5, next));
    steps.forEach(function (node) { node.classList.toggle('is-active', Number(node.dataset.step) === step); });
    document.getElementById('step-label').textContent = 'Etapa ' + step + ' de 5';
    document.getElementById('step-name').textContent = stepNames[step - 1];
    document.getElementById('progress-bar').style.width = (step * 20) + '%';
    document.getElementById('back-button').hidden = step === 1;
    document.getElementById('next-button').hidden = step === 5;
    document.getElementById('calculate-button').hidden = step !== 5;
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
      foodStyle: data.get('foodStyle'), beverageMode: data.get('beverageMode'), profile: data.get('profile'),
      budgetPerPerson: data.get('budgetPerPerson') ? Number(data.get('budgetPerPerson')) : null,
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

  function optionCard(option, index) {
    var foods = option.mainFoods.map(function (food) { return '<li>' + esc(food) + '</li>'; }).join('');
    var additions = option.additions.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('');
    var notIncluded = option.notIncluded.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('');
    var label = option.exact ? 'Pré-proposta' : 'Validação necessária';
    return '<article class="option-card" data-option="' + esc(option.id) + '">' +
      '<span class="risk-chip risk-chip--' + esc(option.riskLevel) + '">' + label + '</span>' +
      '<h3>' + esc(option.name) + '</h3><p>' + esc(option.description) + '</p>' +
      '<ul>' + foods + '</ul><p><strong>Bebidas:</strong> ' + esc(option.beverageLabel) + '</p>' +
      '<p><strong>Duração:</strong> ' + esc(option.durationHours) + ' horas</p>' +
      '<div class="option-price"><div><strong>' + money.format(option.pricePerPerson) + '</strong><small>por pessoa</small></div><div><strong>' + money.format(option.total) + '</strong><small>total</small></div></div>' +
      '<p class="service-note">Valor final com atendimento incluído.</p>' +
      '<p><small>' + esc(option.validationMessage) + '</small></p>' +
      '<details><summary>Adicionais e itens não incluídos</summary>' +
      '<p><strong>Adicionais sob consulta</strong></p><ul>' + additions + '</ul>' +
      '<p><strong>Não incluídos</strong></p><ul>' + notIncluded + '</ul></details>' +
      '<button class="select-option" type="button" data-select="' + esc(option.id) + '">' + (index === 1 ? 'Escolher esta opção' : 'Selecionar') + '</button></article>';
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
    document.querySelectorAll('[data-select]').forEach(function (item) { item.textContent = item.dataset.select === selectedOptionId ? 'Opção escolhida' : 'Selecionar'; });
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
