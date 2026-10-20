// Horarios de referencia: calculadora NOAA/Meeus, horizonte padrao, UTC-3.
// Executar com node --test tools/analytics/sunset_test.mjs.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const context = { Intl, Date, Math, Number, Object, RangeError, module: { exports: {} } };
runInNewContext(readFileSync(new URL('../../assets/js/por-do-sol.js', import.meta.url), 'utf8'), context);
const solar = context.module.exports;

test('datas de referencia NOAA nas coordenadas da casa', () => {
  for (const [date, time] of [
    ['2026-01-01', '17h48'], ['2026-02-01', '17h56'], ['2026-10-20', '17h25'],
    ['2026-10-31', '17h25'], ['2026-12-31', '17h47'],
  ]) assert.equal(solar.forDate(date).time, time, date);
});

test('data de Fortaleza muda as 03h UTC, independentemente do fuso do aparelho', () => {
  assert.equal(solar.dateLocalBrasil(new Date('2026-10-21T02:59:59Z')), '2026-10-20');
  assert.equal(solar.dateLocalBrasil(new Date('2026-10-21T03:00:00Z')), '2026-10-21');
});

test('apos o horario calculado, a proxima ocorrencia e amanha', () => {
  const instant = solar.forDate('2026-10-20').timestamp;
  const before = solar.todayAndTomorrow(new Date(instant - 1));
  const after = solar.todayAndTomorrow(new Date(instant));
  assert.equal(before.hasPassed, false);
  assert.equal(before.next.dateISO, '2026-10-20');
  assert.equal(after.hasPassed, true);
  assert.equal(after.next.dateISO, '2026-10-21');
});

test('virada do ano e ano bissexto usam datas civis validas', () => {
  assert.equal(solar.todayAndTomorrow(new Date('2027-01-01T02:30:00Z')).tomorrow.dateISO, '2027-01-01');
  assert.equal(solar.forDate('2028-02-29').dateISO, '2028-02-29');
  assert.throws(() => solar.forDate('2026-02-29'), RangeError);
  assert.throws(() => solar.forDate('2026-13-01'), RangeError);
});
