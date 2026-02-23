/**
 * Amaréth Calendar Engine
 * Shared computation module — no DOM dependencies.
 * Used by index.html, astro.html, and test_calendar.mjs.
 */

// ========== SUNCALC (minimal inline implementation) ==========
export const RAD = Math.PI / 180;
export const DAY_MS = 1000 * 60 * 60 * 24;
const J1970 = 2440588;
const J2000 = 2451545;
const E = RAD * 23.4397; // obliquity of earth

function toJulian(date) { return date.valueOf() / DAY_MS - 0.5 + J1970; }
function fromJulian(j) { return new Date((j + 0.5 - J1970) * DAY_MS); }
function toDays(date) { return toJulian(date) - J2000; }

function solarMeanAnomaly(d) { return RAD * (357.5291 + 0.98560028 * d); }
function eclipticLongitudeSun(M) {
    const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2*M) + 0.0003 * Math.sin(3*M));
    const P = RAD * 102.9372; // perihelion
    return M + C + P + Math.PI;
}
function sunDeclination(lsun) { return Math.asin(Math.sin(E) * Math.sin(lsun)); }
function rightAscension(lsun) { return Math.atan2(Math.sin(lsun) * Math.cos(E), Math.cos(lsun)); }

function julianCycle(d, lw) { return Math.round(d - 0.0009 - lw / (2 * Math.PI)); }
function approxTransit(Ht, lw, n) { return 0.0009 + (Ht + lw) / (2 * Math.PI) + n; }
function solarTransitJ(ds, M, L) { return J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L); }
function hourAngle(h, phi, dec) {
    const cosH = (Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
    return cosH; // return raw cos(H) so we can detect polar conditions
}

export function getSunTimes(date, lat, lng) {
    const lw = RAD * -lng;
    const phi = RAD * lat;
    const d = toDays(date);
    const n = julianCycle(d, lw);
    const ds = approxTransit(0, lw, n);
    const M = solarMeanAnomaly(ds);
    const L = eclipticLongitudeSun(M);
    const dec = sunDeclination(L);
    const Jnoon = solarTransitJ(ds, M, L);

    const h0 = RAD * -0.833; // sunrise angle (accounting for refraction)
    const cosH = hourAngle(h0, phi, dec);

    // Polar detection
    if (cosH > 1) {
        return { polarNight: true, noon: fromJulian(Jnoon) };
    }
    if (cosH < -1) {
        return { polarDay: true, noon: fromJulian(Jnoon) };
    }

    const H = Math.acos(cosH);
    const Jset = solarTransitJ(approxTransit(H, lw, n), M, L);
    const Jrise = Jnoon - (Jset - Jnoon);

    return {
        sunrise: fromJulian(Jrise),
        sunset: fromJulian(Jset),
        noon: fromJulian(Jnoon),
    };
}

// ========== ZODIAC CALENDAR (Meeus solar longitude) ==========
export function julianDay(year, month, day, hour = 0) {
    if (month <= 2) { year -= 1; month += 12; }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716)) +
           Math.floor(30.6001 * (month + 1)) + day + hour / 24 + B - 1524.5;
}

export function jdToDate(jd) {
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

export function sunLongitude(jd) {
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

export function findSunCrossing(targetLon, startJD) {
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

export const ZODIAC = [
    { name: "Arieneum",    symbol: "\u2648", latin: "Aries",       lon: 0,   element: "fire",  modality: "cardinal", elColor: "#d4603a" },
    { name: "Taureneum",   symbol: "\u2649", latin: "Taurus",      lon: 30,  element: "earth", modality: "fixed",    elColor: "#5a9a40" },
    { name: "Geminion",    symbol: "\u264a", latin: "Gemini",      lon: 60,  element: "air",   modality: "mutable",  elColor: "#d4c44a" },
    { name: "Cancerion",   symbol: "\u264b", latin: "Cancer",      lon: 90,  element: "water", modality: "cardinal", elColor: "#4058a8" },
    { name: "Leon",        symbol: "\u264c", latin: "Leo",         lon: 120, element: "fire",  modality: "fixed",    elColor: "#d4603a" },
    { name: "Virgeon",     symbol: "\u264d", latin: "Virgo",       lon: 150, element: "earth", modality: "mutable",  elColor: "#5a9a40" },
    { name: "Libreon",     symbol: "\u264e", latin: "Libra",       lon: 180, element: "air",   modality: "cardinal", elColor: "#d4c44a" },
    { name: "Scorpion",    symbol: "\u264f", latin: "Scorpio",     lon: 210, element: "water", modality: "fixed",    elColor: "#4058a8" },
    { name: "Sagittarion", symbol: "\u2650", latin: "Sagittarius", lon: 240, element: "fire",  modality: "mutable",  elColor: "#d4603a" },
    { name: "Caprineum",   symbol: "\u2651", latin: "Capricorn",   lon: 270, element: "earth", modality: "cardinal", elColor: "#5a9a40" },
    { name: "Aquarion",    symbol: "\u2652", latin: "Aquarius",    lon: 300, element: "air",   modality: "fixed",    elColor: "#d4c44a" },
    { name: "Piscion",     symbol: "\u2653", latin: "Pisces",      lon: 330, element: "water", modality: "mutable",  elColor: "#4058a8" },
];

export const ELEMENT_LABELS = { fire: "Ogien", earth: "Ziemia", air: "Powietrze", water: "Woda" };
export const MODALITY_LABELS = { cardinal: "Kardynalny", fixed: "Staly", mutable: "Zmienny" };

export const DAY_NAMES = ["Pn", "Wt", "Sr", "Cz", "Pt", "So", "Nd"];

// ========== PLANETARY HOURS ==========
export const CHALDEAN = [
    { name: "Saturn",  symbol: "\u2644", hex: "#808080" },
    { name: "Jowisz",  symbol: "\u2643", hex: "#4080d0" },
    { name: "Mars",    symbol: "\u2642", hex: "#d44040" },
    { name: "Slonce",  symbol: "\u2609", hex: "#f0c040" },
    { name: "Wenus",   symbol: "\u2640", hex: "#40b880" },
    { name: "Merkury", symbol: "\u263F", hex: "#a080d0" },
    { name: "Ksiezyc", symbol: "\u263D", hex: "#c0c8d8" },
];

// Day ruler index into CHALDEAN: Sun=0, Mon=1, ...
export const DAY_RULER_IDX = [3, 6, 2, 5, 1, 4, 0]; // Sun, Mon, Tue, Wed, Thu, Fri, Sat

export function getPlanetaryHours(sunrise, sunset, nextSunrise, dayOfWeek) {
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
            num: i + 1,
            isDay,
            planet: CHALDEAN[chIdx % 7],
            start: new Date(base.getTime() + hourIdx * hourMs),
            end: new Date(base.getTime() + (hourIdx + 1) * hourMs),
            durationMin: hourMs / 60000,
        });
        chIdx = (chIdx + 1) % 7;
    }
    return { hours, dayHourMin: dayHourMs / 60000, nightHourMin: nightHourMs / 60000 };
}

// ========== INGRESS CACHE ==========
const ingressCache = {};

export function getIngresses(year) {
    if (ingressCache[year]) return ingressCache[year];
    const startJD = julianDay(year, 2, 1);
    const ingresses = [];
    let searchJD = startJD;
    for (let i = 0; i < 12; i++) {
        if (i === 0) searchJD = startJD;
        const jd = findSunCrossing(i * 30, searchJD);
        const date = jdToDate(jd);
        ingresses.push({ signIndex: i, ...ZODIAC[i], jd, date, dateStr: date.toISOString().slice(0, 10) });
        searchJD = jd + 25;
    }
    ingressCache[year] = ingresses;
    return ingresses;
}

export function truncToDate(d) { return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }

/**
 * Get the effective start date for a zodiac month at a given location.
 * Rule: month starts on the first sunrise AFTER the ingress.
 * If ingress is before sunrise on that day → month starts that day.
 * If ingress is after sunrise on that day → month starts next day.
 * Without location, falls back to UTC date of ingress.
 */
export function effectiveMonthStart(ingressDate, lat, lng) {
    if (lat === null || lng === null) {
        return truncToDate(ingressDate);
    }
    // Get sunrise on the ingress day
    const st = getSunTimes(ingressDate, lat, lng);
    if (st.polarDay || st.polarNight) {
        return truncToDate(ingressDate); // fallback for polar
    }
    if (ingressDate.getTime() <= st.sunrise.getTime()) {
        // Ingress happened before sunrise → this day's sunrise is already in the new sign
        return truncToDate(ingressDate);
    } else {
        // Ingress happened after sunrise → next day is the first full day in new sign
        return truncToDate(ingressDate) + DAY_MS;
    }
}

export function getMonthStartDates(year, lat, lng) {
    const ingresses = getIngresses(year);
    return ingresses.map(ing => effectiveMonthStart(ing.date, lat, lng));
}

export function getMonthDays(year, monthIndex, lat, lng) {
    const starts = getMonthStartDates(year, lat, lng);
    const start = starts[monthIndex];
    let end;
    if (monthIndex < 11) {
        end = starts[monthIndex + 1];
    } else {
        const nextStarts = getMonthStartDates(year + 1, lat, lng);
        end = nextStarts[0];
    }
    return (end - start) / DAY_MS;
}

export function gregorianToZodiac(date, lat, lng) {
    const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dateMs = truncToDate(dateOnly);
    let zodiacYear = dateOnly.getUTCFullYear();

    // Check if date is before this year's Aries start
    let starts = getMonthStartDates(zodiacYear, lat, lng);
    if (dateMs < starts[0]) {
        zodiacYear -= 1;
        starts = getMonthStartDates(zodiacYear, lat, lng);
    }

    // Find which month
    let monthIdx = 0;
    for (let i = 11; i >= 0; i--) {
        if (dateMs >= starts[i]) { monthIdx = i; break; }
    }

    const day = Math.round((dateMs - starts[monthIdx]) / DAY_MS) + 1;
    return { year: zodiacYear, month: monthIdx + 1, day, sign: ZODIAC[monthIdx] };
}

// ========== AMARÉTH ERA ==========
// Amaréth year 1 = zodiac year starting at Aries ingress 2026
// Amaréth year 0 = zodiac year 2025 (before the new era)
export const AMARETH_EPOCH = 2025; // zodiac year 2025 = Amaréth year 0
export function toAmareth(zodiacYear) { return zodiacYear - AMARETH_EPOCH; }
export function fromAmareth(amarethYear) { return amarethYear + AMARETH_EPOCH; }
export function fmtAmarethYear(zodiacYear) {
    const a = toAmareth(zodiacYear);
    if (a > 0) return `Rok ${a} A.A.`;
    if (a === 0) return `Rok 0`;
    return `Rok ${Math.abs(a)} p.A.`;
}

// ========== UTILITY ==========
export function fmtTime(d) {
    return d.toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' });
}
