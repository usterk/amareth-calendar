/**
 * Tests for frontend zodiac calendar logic.
 * Extracts the core algorithms from index.html and verifies boundaries.
 * Run: node test_calendar.mjs
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

// ========== Extracted from index.html ==========

const RAD = Math.PI / 180;
const DAY_MS = 1000 * 60 * 60 * 24;

function julianDay(year, month, day, hour = 0) {
    if (month <= 2) { year -= 1; month += 12; }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716)) +
           Math.floor(30.6001 * (month + 1)) + day + hour / 24 + B - 1524.5;
}

function jdToDate(jd) {
    const z = Math.floor(jd + 0.5);
    const f = jd + 0.5 - z;
    let a = z;
    if (z >= 2299161) {
        const alpha = Math.floor((z - 1867216.25) / 36524.25);
        a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);
    const day = b - d - Math.floor(30.6001 * e);
    const month = e < 14 ? e - 1 : e - 13;
    const year = month > 2 ? c - 4716 : c - 4715;
    const hours = f * 24;
    return new Date(Date.UTC(year, month - 1, day, Math.floor(hours), Math.round((hours % 1) * 60)));
}

function sunLongitude(jd) {
    const T = (jd - 2451545.0) / 36525;
    const L0 = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
    const M = ((357.52911 + 35999.05029 * T - 0.0001537 * T * T) % 360) * Math.PI / 180;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M)
            + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
            + 0.000289 * Math.sin(3 * M);
    const omega = (125.04 - 1934.136 * T) * Math.PI / 180;
    const lon = L0 + C - 0.00569 - 0.00478 * Math.sin(omega);
    return ((lon % 360) + 360) % 360;
}

function findSunCrossing(targetLon, startJD) {
    let currentLon = sunLongitude(startJD);
    let diff = ((targetLon - currentLon) + 360) % 360;
    if (diff === 0) diff = 360;
    let estJD = startJD + diff / 0.9856;
    let lo = estJD - 5, hi = estJD + 5;
    for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2;
        const lon = sunLongitude(mid);
        const d = ((lon - targetLon) + 540) % 360 - 180;
        if (Math.abs(d) < 0.0001) return mid;
        const dLo = ((sunLongitude(lo) - targetLon) + 540) % 360 - 180;
        if ((dLo < 0 && d < 0) || (dLo > 0 && d > 0)) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
}

const ZODIAC = [
    { name: "Arieneum",    lon: 0 },   { name: "Taureneum",   lon: 30 },
    { name: "Geminion",    lon: 60 },  { name: "Cancerion",   lon: 90 },
    { name: "Leon",        lon: 120 }, { name: "Virgeon",     lon: 150 },
    { name: "Libreon",     lon: 180 }, { name: "Scorpion",    lon: 210 },
    { name: "Sagittarion", lon: 240 }, { name: "Caprineum",   lon: 270 },
    { name: "Aquarion",    lon: 300 }, { name: "Piscion",     lon: 330 },
];

const ingressCache = {};

function getIngresses(year) {
    if (ingressCache[year]) return ingressCache[year];
    const startJD = julianDay(year, 2, 1);
    const ingresses = [];
    let searchJD = startJD;
    for (let i = 0; i < 12; i++) {
        if (i === 0) searchJD = startJD;
        const jd = findSunCrossing(i * 30, searchJD);
        const date = jdToDate(jd);
        ingresses.push({ signIndex: i, ...ZODIAC[i], jd, date });
        searchJD = jd + 25;
    }
    ingressCache[year] = ingresses;
    return ingresses;
}

function truncToDate(d) { return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }

function getMonthDays(year, monthIndex) {
    const ingresses = getIngresses(year);
    const start = truncToDate(ingresses[monthIndex].date);
    let end;
    if (monthIndex < 11) end = truncToDate(ingresses[monthIndex + 1].date);
    else end = truncToDate(getIngresses(year + 1)[0].date);
    return (end - start) / DAY_MS;
}

function gregorianToZodiac(date) {
    const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    let zodiacYear = dateOnly.getUTCFullYear();
    let ingresses = getIngresses(zodiacYear);
    const ariesDate = new Date(Date.UTC(ingresses[0].date.getUTCFullYear(), ingresses[0].date.getUTCMonth(), ingresses[0].date.getUTCDate()));
    if (dateOnly < ariesDate) { zodiacYear -= 1; ingresses = getIngresses(zodiacYear); }
    let monthIdx = 0;
    for (let i = 11; i >= 0; i--) {
        const mStart = new Date(Date.UTC(ingresses[i].date.getUTCFullYear(), ingresses[i].date.getUTCMonth(), ingresses[i].date.getUTCDate()));
        if (dateOnly >= mStart) { monthIdx = i; break; }
    }
    const monthStart = new Date(Date.UTC(ingresses[monthIdx].date.getUTCFullYear(), ingresses[monthIdx].date.getUTCMonth(), ingresses[monthIdx].date.getUTCDate()));
    const day = Math.round((dateOnly - monthStart) / DAY_MS) + 1;
    return { year: zodiacYear, month: monthIdx + 1, day, sign: ZODIAC[monthIdx] };
}

// ========== SunCalc (extracted) ==========

const J1970 = 2440588, J2000 = 2451545, E = RAD * 23.4397;
function toJulian(date) { return date.valueOf() / DAY_MS - 0.5 + J1970; }
function fromJulian(j) { return new Date((j + 0.5 - J1970) * DAY_MS); }
function toDays(date) { return toJulian(date) - J2000; }
function solarMeanAnomaly(d) { return RAD * (357.5291 + 0.98560028 * d); }
function eclipticLongitudeSun(M) {
    const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2*M) + 0.0003 * Math.sin(3*M));
    const P = RAD * 102.9372;
    return M + C + P + Math.PI;
}
function sunDeclination(lsun) { return Math.asin(Math.sin(E) * Math.sin(lsun)); }
function julianCycle(d, lw) { return Math.round(d - 0.0009 - lw / (2 * Math.PI)); }
function approxTransit(Ht, lw, n) { return 0.0009 + (Ht + lw) / (2 * Math.PI) + n; }
function solarTransitJ(ds, M, L) { return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L); }
function hourAngle(h, phi, dec) {
    return (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
}
function getSunTimes(date, lat, lng) {
    const lw = RAD * -lng, phi = RAD * lat, d = toDays(date);
    const n = julianCycle(d, lw);
    const ds = approxTransit(0, lw, n);
    const M = solarMeanAnomaly(ds), L = eclipticLongitudeSun(M);
    const dec = sunDeclination(L), Jnoon = solarTransitJ(ds, M, L);
    const h0 = RAD * -0.833;
    const cosH = hourAngle(h0, phi, dec);
    if (cosH > 1) return { polarNight: true, noon: fromJulian(Jnoon) };
    if (cosH < -1) return { polarDay: true, noon: fromJulian(Jnoon) };
    const H = Math.acos(cosH);
    const Jset = solarTransitJ(approxTransit(H, lw, n), M, L);
    const Jrise = Jnoon - (Jset - Jnoon);
    return { sunrise: fromJulian(Jrise), sunset: fromJulian(Jset), noon: fromJulian(Jnoon) };
}

// ========== Planetary Hours (extracted) ==========

const CHALDEAN = [
    { name: "Saturn" }, { name: "Jowisz" }, { name: "Mars" },
    { name: "Slonce" }, { name: "Wenus" }, { name: "Merkury" }, { name: "Ksiezyc" },
];
const DAY_RULER_IDX = [3, 6, 2, 5, 1, 4, 0];

function getPlanetaryHours(sunrise, sunset, nextSunrise, dayOfWeek) {
    const dayDur = sunset - sunrise;
    const nightDur = nextSunrise - sunset;
    const dayHourMs = dayDur / 12;
    const nightHourMs = nightDur / 12;
    let chIdx = DAY_RULER_IDX[dayOfWeek];
    const hours = [];
    for (let i = 0; i < 24; i++) {
        const isDay = i < 12;
        const hourMs = isDay ? dayHourMs : nightHourMs;
        const base = isDay ? sunrise : sunset;
        const hourIdx = isDay ? i : i - 12;
        hours.push({
            num: i + 1, isDay,
            planet: CHALDEAN[chIdx % 7],
            start: new Date(base.getTime() + hourIdx * hourMs),
            end: new Date(base.getTime() + (hourIdx + 1) * hourMs),
            durationMin: hourMs / 60000,
        });
        chIdx = (chIdx + 1) % 7;
    }
    return { hours, dayHourMin: dayHourMs / 60000, nightHourMin: nightHourMs / 60000 };
}

// ========== Helper ==========
function utcDate(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
let passed = 0, failed = 0, total = 0;

function check(name, condition, detail = '') {
    total++;
    if (condition) {
        passed++;
    } else {
        failed++;
        console.log(`  FAIL: ${name} ${detail}`);
    }
}

// ========== TESTS ==========

console.log('\n=== Testy Frontendu Kalendarza Zodiakowego ===\n');

// --- 1. Ingress dates match backend (within 1 day tolerance for Meeus vs Skyfield) ---
console.log('--- Ingressy 2026 (porownanie z backendem) ---');
const backendIngresses2026 = [
    [2026, 3, 20], [2026, 4, 20], [2026, 5, 21], [2026, 6, 21],
    [2026, 7, 22], [2026, 8, 23], [2026, 9, 23], [2026, 10, 23],
    [2026, 11, 22], [2026, 12, 21], [2027, 1, 20], [2027, 2, 18],
];
const ings2026 = getIngresses(2026);
for (let i = 0; i < 12; i++) {
    const fe = ings2026[i].date;
    const [by, bm, bd] = backendIngresses2026[i];
    const beDate = utcDate(by, bm, bd);
    const diffDays = Math.abs(truncToDate(fe) - truncToDate(beDate)) / DAY_MS;
    check(
        `Ingress ${ZODIAC[i].name}`,
        diffDays <= 1,
        `frontend=${fe.toISOString().slice(0,10)} backend=${by}-${String(bm).padStart(2,'0')}-${String(bd).padStart(2,'0')} diff=${diffDays}d`
    );
}

// --- 2. First day of each month ---
console.log('--- Pierwszy dzien kazdego miesiaca ---');
for (let i = 0; i < 12; i++) {
    const ingDate = ings2026[i].date;
    const dateOnly = utcDate(ingDate.getUTCFullYear(), ingDate.getUTCMonth() + 1, ingDate.getUTCDate());
    const zd = gregorianToZodiac(dateOnly);
    check(
        `Month ${i+1} first day`,
        zd.month === i + 1 && zd.day === 1,
        `got month=${zd.month} day=${zd.day}`
    );
}

// --- 3. Month transitions ---
console.log('--- Przejscia miedzy miesiacami ---');
for (let i = 0; i < 11; i++) {
    const nextIngDate = ings2026[i + 1].date;
    const nextDateOnly = utcDate(nextIngDate.getUTCFullYear(), nextIngDate.getUTCMonth() + 1, nextIngDate.getUTCDate());
    const dayBefore = new Date(nextDateOnly.getTime() - DAY_MS);
    const zdBefore = gregorianToZodiac(dayBefore);
    const zdNext = gregorianToZodiac(nextDateOnly);
    check(
        `Transition ${i+1}->${i+2}`,
        zdBefore.month === i + 1 && zdNext.month === i + 2 && zdNext.day === 1,
        `before: m=${zdBefore.month} d=${zdBefore.day}, next: m=${zdNext.month} d=${zdNext.day}`
    );
}

// --- 4. Year boundary ---
console.log('--- Granica roku ---');
{
    const ariesDate = ings2026[0].date;
    const ariesDateOnly = utcDate(ariesDate.getUTCFullYear(), ariesDate.getUTCMonth() + 1, ariesDate.getUTCDate());
    const dayBefore = new Date(ariesDateOnly.getTime() - DAY_MS);
    const zdBefore = gregorianToZodiac(dayBefore);
    check('Day before Aries 2026 is year 2025', zdBefore.year === 2025, `got year=${zdBefore.year}`);
    const zdAries = gregorianToZodiac(ariesDateOnly);
    check('Aries day is year 2026 m1 d1', zdAries.year === 2026 && zdAries.month === 1 && zdAries.day === 1,
        `got y=${zdAries.year} m=${zdAries.month} d=${zdAries.day}`);
    const zdJan = gregorianToZodiac(utcDate(2026, 1, 15));
    check('Jan 15 2026 is zodiac year 2025', zdJan.year === 2025, `got year=${zdJan.year}`);
}

// --- 5. Round-trip ---
console.log('--- Round-trip greg->zodiac->greg ---');
const roundTripDates = [
    utcDate(2026, 3, 20), utcDate(2026, 4, 15), utcDate(2026, 7, 4),
    utcDate(2026, 12, 25), utcDate(2027, 1, 15), utcDate(2026, 1, 1),
];
for (const d of roundTripDates) {
    const zd = gregorianToZodiac(d);
    // Reconstruct Gregorian from zodiac
    const ings = getIngresses(zd.year);
    const monthStart = ings[zd.month - 1].date;
    const reconstructed = new Date(
        Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), monthStart.getUTCDate()) + (zd.day - 1) * DAY_MS
    );
    const match = truncToDate(reconstructed) === truncToDate(d);
    check(`RT ${d.toISOString().slice(0,10)}`, match,
        `zodiac: y=${zd.year} m=${zd.month} d=${zd.day} -> ${reconstructed.toISOString().slice(0,10)}`);
}

// --- 6. Month lengths ---
console.log('--- Dlugosci miesiecy ---');
let totalDays2026 = 0;
for (let i = 0; i < 12; i++) {
    const days = getMonthDays(2026, i);
    totalDays2026 += days;
    check(`Month ${i+1} length ${days}`, days >= 29 && days <= 32, `got ${days}`);
}
check('Year 2026 total days', totalDays2026 === 365 || totalDays2026 === 366, `got ${totalDays2026}`);

// Test across years
for (const year of [2024, 2025, 2027, 2028]) {
    let total = 0;
    for (let i = 0; i < 12; i++) total += getMonthDays(year, i);
    check(`Year ${year} total`, total === 365 || total === 366, `got ${total}`);
}

// --- 7. No gaps in coverage ---
console.log('--- Ciaglosc pokrycia (brak luk) ---');
{
    const start = utcDate(ings2026[0].date.getUTCFullYear(), ings2026[0].date.getUTCMonth() + 1, ings2026[0].date.getUTCDate());
    const ings2027 = getIngresses(2027);
    const end = utcDate(ings2027[0].date.getUTCFullYear(), ings2027[0].date.getUTCMonth() + 1, ings2027[0].date.getUTCDate());
    let prev = null;
    let gapFound = false;
    let current = new Date(start.getTime());
    while (current < end) {
        const zd = gregorianToZodiac(current);
        if (prev) {
            if (zd.month === prev.month) {
                if (zd.day !== prev.day + 1) { gapFound = true; break; }
            } else {
                if (zd.day !== 1) { gapFound = true; break; }
            }
        }
        prev = zd;
        current = new Date(current.getTime() + DAY_MS);
    }
    check('No gaps in 2026 coverage', !gapFound);
}

// --- 8. Planetary Hours ---
console.log('--- Godziny Planetarne ---');
{
    // Warsaw, June 21 2026 (long day)
    const date = utcDate(2026, 6, 21);
    const st = getSunTimes(date, 52.23, 21.01);
    check('Warsaw June sunrise exists', !st.polarDay && !st.polarNight);
    check('Warsaw June sunrise before sunset', st.sunrise < st.sunset);

    // Compute hours
    const tomorrow = new Date(date.getTime() + DAY_MS);
    const stTomorrow = getSunTimes(tomorrow, 52.23, 21.01);
    const ph = getPlanetaryHours(st.sunrise, st.sunset, stTomorrow.sunrise, date.getUTCDay());

    check('24 planetary hours', ph.hours.length === 24);
    check('12 day hours', ph.hours.filter(h => h.isDay).length === 12);
    check('12 night hours', ph.hours.filter(h => h.isDay === false).length === 12);

    // Day hours longer than night hours in summer
    check('Summer day hours > night hours', ph.dayHourMin > ph.nightHourMin,
        `day=${ph.dayHourMin.toFixed(1)} night=${ph.nightHourMin.toFixed(1)}`);

    // Hours are contiguous (no gaps)
    let contiguous = true;
    for (let i = 1; i < 24; i++) {
        if (Math.abs(ph.hours[i].start.getTime() - ph.hours[i-1].end.getTime()) > 1000) {
            contiguous = false; break;
        }
    }
    check('Hours contiguous (no gaps)', contiguous);

    // First hour starts at sunrise
    check('First hour starts at sunrise',
        Math.abs(ph.hours[0].start.getTime() - st.sunrise.getTime()) < 1000);

    // Hour 13 starts at sunset
    check('Hour 13 starts at sunset',
        Math.abs(ph.hours[12].start.getTime() - st.sunset.getTime()) < 1000);

    // Last hour ends at next sunrise
    check('Last hour ends at next sunrise',
        Math.abs(ph.hours[23].end.getTime() - stTomorrow.sunrise.getTime()) < 1000);

    // Chaldean order for Saturday (day 6): Saturn(0) starts
    const satDate = utcDate(2026, 3, 21); // Saturday
    const stSat = getSunTimes(satDate, 52.23, 21.01);
    const stSatTomorrow = getSunTimes(new Date(satDate.getTime() + DAY_MS), 52.23, 21.01);
    const phSat = getPlanetaryHours(stSat.sunrise, stSat.sunset, stSatTomorrow.sunrise, 6); // Saturday=6
    check('Saturday 1st hour = Saturn', phSat.hours[0].planet.name === 'Saturn',
        `got ${phSat.hours[0].planet.name}`);

    // Sunday (day 0): Sun(3) starts
    const sunDate = utcDate(2026, 3, 22); // Sunday
    const stSun = getSunTimes(sunDate, 52.23, 21.01);
    const stSunTomorrow = getSunTimes(new Date(sunDate.getTime() + DAY_MS), 52.23, 21.01);
    const phSun = getPlanetaryHours(stSun.sunrise, stSun.sunset, stSunTomorrow.sunrise, 0);
    check('Sunday 1st hour = Slonce', phSun.hours[0].planet.name === 'Slonce',
        `got ${phSun.hours[0].planet.name}`);

    // Monday (day 1): Moon(6) starts
    const monDate = utcDate(2026, 3, 23); // Monday
    const stMon = getSunTimes(monDate, 52.23, 21.01);
    const stMonTomorrow = getSunTimes(new Date(monDate.getTime() + DAY_MS), 52.23, 21.01);
    const phMon = getPlanetaryHours(stMon.sunrise, stMon.sunset, stMonTomorrow.sunrise, 1);
    check('Monday 1st hour = Ksiezyc', phMon.hours[0].planet.name === 'Ksiezyc',
        `got ${phMon.hours[0].planet.name}`);
}

// --- 9. Polar conditions ---
console.log('--- Warunki polarne ---');
{
    // Svalbard summer (June) = polar day
    const svalbardSummer = getSunTimes(utcDate(2026, 6, 21), 78.22, 15.64);
    check('Svalbard June = polar day', svalbardSummer.polarDay === true);

    // Svalbard winter (December) = polar night
    const svalbardWinter = getSunTimes(utcDate(2026, 12, 21), 78.22, 15.64);
    check('Svalbard Dec = polar night', svalbardWinter.polarNight === true);

    // Warsaw should never be polar
    const warsawSummer = getSunTimes(utcDate(2026, 6, 21), 52.23, 21.01);
    check('Warsaw June = normal', !warsawSummer.polarDay && !warsawSummer.polarNight);
    const warsawWinter = getSunTimes(utcDate(2026, 12, 21), 52.23, 21.01);
    check('Warsaw Dec = normal', !warsawWinter.polarDay && !warsawWinter.polarNight);
}

// --- 10. Winter hours shorter, equinox ~equal ---
console.log('--- Sezonowe dlugosci godzin ---');
{
    // Warsaw winter solstice (Dec 21)
    const wDate = utcDate(2026, 12, 21);
    const wSt = getSunTimes(wDate, 52.23, 21.01);
    const wStT = getSunTimes(new Date(wDate.getTime() + DAY_MS), 52.23, 21.01);
    const wPh = getPlanetaryHours(wSt.sunrise, wSt.sunset, wStT.sunrise, wDate.getUTCDay());
    check('Winter day hours < night hours', wPh.dayHourMin < wPh.nightHourMin,
        `day=${wPh.dayHourMin.toFixed(1)} night=${wPh.nightHourMin.toFixed(1)}`);

    // Equinox (March 20) - hours should be roughly equal
    const eDate = utcDate(2026, 3, 20);
    const eSt = getSunTimes(eDate, 52.23, 21.01);
    const eStT = getSunTimes(new Date(eDate.getTime() + DAY_MS), 52.23, 21.01);
    const ePh = getPlanetaryHours(eSt.sunrise, eSt.sunset, eStT.sunrise, eDate.getUTCDay());
    const eqDiff = Math.abs(ePh.dayHourMin - ePh.nightHourMin);
    check('Equinox day~=night hours (diff < 10min)', eqDiff < 10,
        `day=${ePh.dayHourMin.toFixed(1)} night=${ePh.nightHourMin.toFixed(1)} diff=${eqDiff.toFixed(1)}`);
}

// --- 11. Cross-validation backend vs frontend ---
console.log('--- Cross-walidacja backend vs frontend ---');
{
    // These dates should give same zodiac date in both systems
    const testDates = [
        [2026, 3, 20, 2026, 1, 1],   // Aries ingress
        [2026, 4, 15, 2026, 1, -1],   // mid-Arieneum (day auto)
        [2026, 12, 25, 2026, 10, -1], // Caprineum
        [2026, 1, 15, 2025, -1, -1],  // previous zodiac year
    ];
    for (const [gy, gm, gd, expectedYear, expectedMonth, _] of testDates) {
        const zd = gregorianToZodiac(utcDate(gy, gm, gd));
        check(
            `Cross-val ${gy}-${String(gm).padStart(2,'0')}-${String(gd).padStart(2,'0')} year`,
            zd.year === expectedYear,
            `expected year=${expectedYear} got=${zd.year}`
        );
        if (expectedMonth > 0) {
            check(
                `Cross-val ${gy}-${String(gm).padStart(2,'0')}-${String(gd).padStart(2,'0')} month`,
                zd.month === expectedMonth,
                `expected month=${expectedMonth} got=${zd.month}`
            );
        }
    }
}

// ========== Summary ==========
console.log(`\n=== Wyniki: ${passed}/${total} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
