# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Amareth Calendar** — zodiac-based calendar where each month = Sun's transit through a zodiac sign. Year starts at vernal equinox. Includes Planetary Hours (Horae Temporales) with location-aware sunrise/sunset.

- **Repo:** https://github.com/usterk/amareth-calendar
- **Live:** https://usterk.github.io/amareth-calendar/
- **Era:** Year 1 A.A. = Aries ingress 2026, Year 0 = current pre-era period

## Commands

### Frontend (no build step)
```bash
open frontend/index.html            # Run in browser
node frontend/test_calendar.mjs     # 88 tests
```

### Backend
```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

.venv/bin/python cli.py today                 # Current Amareth date
.venv/bin/python cli.py convert 2026-04-15    # Gregorian -> Amareth
.venv/bin/python cli.py year 1                # Show Rok 1 A.A.
.venv/bin/python cli.py month 1 3             # Geminion, Rok 1

.venv/bin/python -m pytest tests/ -v          # 88 tests
.venv/bin/python -m pytest tests/test_calendar_boundaries.py::TestRoundTrip -v  # Single class

.venv/bin/python generate_cache.py --start 2000 --end 2050  # Regenerate cache
```

## Architecture

**Two independent implementations of the same calendar:**

| | Backend (Python) | Frontend (JS) |
|---|---|---|
| Algorithm | Skyfield + JPL DE440s | Meeus formula (inline) |
| Precision | sub-arcsecond | ~0.01° (day-level) |
| Dependencies | skyfield | none |
| Purpose | CLI, tests, archival precision | Browser app, self-contained |

Cross-validation in tests allows ±1 day tolerance between the two.

### Key Design Decisions

**Month boundaries are location-dependent:** A month starts on the first sunrise after the Sun crosses into the new zodiac sign. The same ingress can produce different calendar dates in different cities (±1 day). Without location, falls back to UTC date.

**Amareth era:** `AMARETH_EPOCH = 2025` in both `core/calendar.py` and `frontend/index.html`. Amareth year = zodiac year - 2025. Format: "Rok 1 A.A." (positive), "Rok 0" (zero), "Rok 5 p.A." (negative).

**Planetary Hours:** 24 unequal hours (12 day + 12 night). Day hours = sunrise-to-sunset ÷ 12, night = sunset-to-next-sunrise ÷ 12. Chaldean planet order. First day-hour ruled by day's planet (Sun→Sunday, Moon→Monday, etc.). Polar conditions: show warning, hide hours.

**Default location:** Torun (53.01, 18.60). Week starts Monday. Day names are placeholders (Pn/Wt/Sr...) — custom names TBD.

### Frontend (`index.html`) — single file, key sections:

1. **SunCalc** (line ~235) — sunrise/sunset, polar detection
2. **Meeus solar longitude** (line ~324) — `sunLongitude(jd)`, `findSunCrossing()`
3. **Zodiac definitions** (line ~353) — 12 signs, Chaldean order, day rulers
4. **Planetary Hours** (line ~384) — `getPlanetaryHours()`, 24-hour computation
5. **Ingress cache + calendar logic** (line ~492) — `getIngresses()`, `effectiveMonthStart()`, `gregorianToZodiac()`
6. **Amareth era** (line ~575) — `toAmareth()`, `fmtAmarethYear()`
7. **SVG clock** (line ~640) — `buildClockSVG()` with wedge segments, hand, center info
8. **Year grid** (line ~832) — `renderYear()` with location-aware month starts

### Backend core modules:

- `ephemeris.py` — Skyfield wrapper. Lazy-loads `de440s.bsp`. `compute_ingresses(year)` uses `almanac.find_discrete()`. JSON cache in `data/ingress_cache.json`.
- `calendar.py` — `ZodiacDate` dataclass, `ZODIAC_SIGNS` list, era conversion functions.
- `converter.py` — `gregorian_to_zodiac()` uses `bisect_right` on ingress dates. `zodiac_to_gregorian()` reverses. `month_length()` handles Piscion→next-year-Aries edge case.

## Gotchas

- Backend CLI `year`/`month` commands take **Amareth year** (not Gregorian). `cli.py year 1` = 2026.
- Ingress cache JSON has string keys (`"2026"` not `2026`) and ISO date strings (no datetime objects).
- Frontend `gregorianToZodiac(date, lat, lng)` requires lat/lng params (null = UTC fallback).
- `de440s.bsp` (~50MB) auto-downloads on first Skyfield use — not committed to git.
- The `effectiveMonthStart` function can shift month start by 1 day depending on location — this is intentional, not a bug.
