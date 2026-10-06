const html = await Deno.readTextFile(new URL('../../index.html', import.meta.url));
const block = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1]).find((s) => s.includes('window.sfAfterFirstPaint ='));

function setup() {
  const listeners = new Map();
  const frames = [];
  const timers = [];
  const scripts = [];
  const window = { requestAnimationFrame(callback) { frames.push(callback); } };
  const document = {
    readyState: 'loading', hidden: false,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    createElement() { return {}; },
    getElementsByTagName() { return [{ parentNode: { insertBefore(script) { scripts.push(script); } } }]; },
  };
  new Function('window', 'document', 'setTimeout', 'clearTimeout', 'fbq', block)(
    window, document, (callback) => { timers.push(callback); return timers.length; }, () => {},
    (...args) => window.fbq(...args));
  return { listeners, frames, timers, scripts, window };
}

Deno.test('Meta enfileira inicializacao e PageView antes de carregar o SDK', () => {
  const state = setup();
  if (state.scripts.length || state.window.fbq.queue.length !== 2) throw new Error('Perdeu fila inicial ou antecipou SDK');
  state.listeners.get('DOMContentLoaded')();
  state.frames.shift()();
  if (state.scripts.length) throw new Error('Carregou antes da primeira pintura');
  state.frames.shift()();
  state.timers[0]();
  if (state.scripts.length !== 1) throw new Error('SDK duplicado ou ausente');
});

Deno.test('primeira interacao antecipa o SDK sem duplicar ou perder eventos', () => {
  const state = setup();
  state.window.fbq('track', 'Contact');
  state.listeners.get('pointerdown')();
  state.timers[0]();
  if (state.scripts.length !== 1 || state.window.fbq.queue.length !== 3) throw new Error('Perdeu evento ou duplicou SDK');
});

Deno.test('limite de espera carrega SDK mesmo sem pintura', () => {
  const state = setup();
  state.timers[0]();
  if (state.scripts.length !== 1) throw new Error('SDK permaneceu bloqueado');
});
