/*
 * Approximate apparent sunset at Sir Fisher, Fortaleza.
 * Equations: NOAA/GML Solar Calculator (Jean Meeus), standard zenith 90.833°.
 * Sources: https://gml.noaa.gov/grad/solcalc/main.js
 *          https://gml.noaa.gov/grad/solcalc/calcdetails.html
 * No dependency, external request or user's location required.
 * This estimates the astronomical event; clouds and local obstructions can hide it.
 */
const FORTALEZA_SUNSET = (() => {
  const LATITUDE = -3.724722;
  const LONGITUDE = -38.490556;
  const TIME_ZONE = 'America/Fortaleza';
  const DAY_MS = 86400000;
  const RAD = Math.PI / 180;
  const dateFormatter = new Intl.DateTimeFormat('en', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });

  function dateLocalBrasil(now = new Date()) {
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new RangeError('Invalid instant');
    const p = Object.fromEntries(dateFormatter.formatToParts(now).map(({type, value}) => [type, value]));
    return `${p.year}-${p.month}-${p.day}`;
  }

  function midnightUTC(dateISO) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new RangeError('Expected YYYY-MM-DD');
    const timestamp = Date.parse(`${dateISO}T00:00:00Z`);
    const year = Number(dateISO.slice(0, 4));
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== dateISO || year < 1800 || year > 2100) {
      throw new RangeError('Expected a valid date between 1800 and 2100');
    }
    return timestamp;
  }

  // Solar declination in radians and equation of time in minutes.
  function solarCoordinates(julianDay) {
    const t = (julianDay - 2451545) / 36525;
    const meanLongitude = ((280.46646 + t * (36000.76983 + t * 0.0003032)) % 360 + 360) % 360 * RAD;
    const anomaly = (357.52911 + t * (35999.05029 - 0.0001537 * t)) * RAD;
    const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    const center = (Math.sin(anomaly) * (1.914602 - t * (0.004817 + 0.000014 * t))
      + Math.sin(2 * anomaly) * (0.019993 - 0.000101 * t)
      + Math.sin(3 * anomaly) * 0.000289) * RAD;
    const omega = (125.04 - 1934.136 * t) * RAD;
    const apparentLongitude = meanLongitude + center - (0.00569 + 0.00478 * Math.sin(omega)) * RAD;
    const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
    const obliquity = (23 + (26 + seconds / 60) / 60 + 0.00256 * Math.cos(omega)) * RAD;
    const y = Math.tan(obliquity / 2) ** 2;
    const equationOfTime = 4 / RAD * (y * Math.sin(2 * meanLongitude) - 2 * eccentricity * Math.sin(anomaly)
      + 4 * eccentricity * y * Math.sin(anomaly) * Math.cos(2 * meanLongitude)
      - 0.5 * y * y * Math.sin(4 * meanLongitude)
      - 1.25 * eccentricity * eccentricity * Math.sin(2 * anomaly));
    return {declination: Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude)), equationOfTime};
  }

  function sunsetMinutesUTC(julianDay) {
    const {declination, equationOfTime} = solarCoordinates(julianDay);
    const latitude = LATITUDE * RAD;
    const hourAngle = Math.acos(Math.cos(90.833 * RAD) / (Math.cos(latitude) * Math.cos(declination))
      - Math.tan(latitude) * Math.tan(declination));
    return 720 - 4 * LONGITUDE + 4 * hourAngle / RAD - equationOfTime;
  }

  function forDate(dateISO) {
    const midnight = midnightUTC(dateISO);
    const julianDay = midnight / DAY_MS + 2440587.5;
    const first = sunsetMinutesUTC(julianDay);
    // Repeat at the first estimate, as NOAA does, to account for motion during the day.
    const minuteUTC = sunsetMinutesUTC(julianDay + first / 1440);
    if (!Number.isFinite(minuteUTC)) throw new RangeError('Sunset calculation failed');
    const timestamp = Math.round((midnight + minuteUTC * 60000) / 60000) * 60000;
    const instant = new Date(timestamp);
    return {dateISO, time: timeFormatter.format(instant).replace(':', 'h'), timestamp, instantISO: instant.toISOString()};
  }

  function todayAndTomorrow(now = new Date()) {
    const dateISO = dateLocalBrasil(now);
    // Advance the civil-date marker in UTC, avoiding the browser's local timezone.
    const tomorrowISO = new Date(midnightUTC(dateISO) + DAY_MS).toISOString().slice(0, 10);
    const today = forDate(dateISO);
    const tomorrow = forDate(tomorrowISO);
    const hasPassed = now.getTime() >= today.timestamp;
    return {today, tomorrow, hasPassed, next: hasPassed ? tomorrow : today};
  }

  return {dateLocalBrasil, forDate, todayAndTomorrow};
})();

if (typeof module !== 'undefined' && module.exports) module.exports = FORTALEZA_SUNSET;


// A tabela em HTML permanece disponivel mesmo sem JavaScript.
if (typeof document !== 'undefined') {
  (function () {
    var clock = document.querySelector('[data-sunset-time]');
    if (!clock) return;
    var label = document.querySelector('[data-sunset-label]');
    var date = document.querySelector('[data-sunset-date]');
    var next = document.querySelector('[data-sunset-next]');
    var formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Fortaleza', day: 'numeric', month: 'long', year: 'numeric'
    });
    function update() {
      try {
        var plan = FORTALEZA_SUNSET.todayAndTomorrow();
        label.textContent = 'Pôr do sol hoje em Fortaleza';
        date.textContent = formatter.format(new Date(plan.today.timestamp)) + ' · horário local (UTC−3)';
        clock.textContent = plan.today.time;
        next.hidden = !plan.hasPassed;
        next.textContent = plan.hasPassed
          ? 'O horário de hoje já passou. Amanhã: aproximadamente ' + plan.tomorrow.time + '.' : '';
      } catch (e) {
        // Uma falha conserva a faixa e a tabela mensal presentes no HTML.
      }
    }
    update();
    window.setInterval(update, 60000);
  })();
}
