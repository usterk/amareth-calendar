# Amareth Calendar

A zodiac-based calendar system where the year begins at the vernal equinox (Sun entering Aries) and each month corresponds to the Sun's transit through a zodiac sign.

## Concept

- **12 months** named after zodiac signs: Arieneum, Taureneum, Geminion, Cancerion, Leon, Virgeon, Libreon, Scorpion, Sagittarion, Caprineum, Aquarion, Piscion
- **Variable month lengths** (29-32 days) determined by actual solar ingress times, following Kepler's 2nd law
- **Location-aware**: month boundaries are set at the first sunrise after the Sun enters a new sign at the observer's location
- **Planetary Hours** (Horae Temporales): ancient timekeeping where day and night are each divided into 12 unequal hours, ruled by planets in Chaldean order
- **Year 1 A.A.** (Annus Amareth) begins at the Aries ingress of 2026

## Structure

```
kalendarz/
  frontend/
    index.html              # Standalone web app (no dependencies)
    test_calendar.mjs        # Frontend tests (Node.js)
  backend/
    core/
      calendar.py            # Calendar definitions, ZodiacDate
      ephemeris.py           # Solar ingress computation (Skyfield)
      converter.py           # Gregorian <-> Zodiac conversion
    cli.py                   # Command-line tool
    generate_cache.py        # Pre-compute ingress cache
    data/
      ingress_cache.json     # Pre-computed ingresses 2000-2050
    tests/
      test_calendar_boundaries.py  # 88 boundary tests
    requirements.txt
```

## Frontend

Open `frontend/index.html` in a browser. No build step, no dependencies.

Features:
- Current Amareth date display with zodiac symbol
- 12-month calendar grid with variable month lengths
- SVG circular clock showing planetary hours with day/night segments
- Sunrise/sunset computation and polar day/night detection
- Date converter (Gregorian to Amareth)
- City selector with 45+ world cities
- Default location: Torun, Poland

The frontend uses the Meeus algorithm for solar longitude and an inline SunCalc implementation for sunrise/sunset. All computation runs in the browser.

## Backend (Python)

### Setup

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### CLI

```bash
# Today's date
.venv/bin/python cli.py today

# Convert a Gregorian date
.venv/bin/python cli.py convert 2026-04-15

# Show a full Amareth year (year 1 = from March 2026)
.venv/bin/python cli.py year 1

# Show a specific month
.venv/bin/python cli.py month 1 1
```

### Generate ingress cache

```bash
.venv/bin/python generate_cache.py --start 2000 --end 2050
```

### Tests

```bash
# Backend (88 tests)
.venv/bin/python -m pytest tests/ -v

# Frontend (88 tests)
node frontend/test_calendar.mjs
```

## How it works

### Calendar dates

1. Compute the exact UTC moment the Sun's ecliptic longitude crosses N x 30 degrees (N=0..11)
2. At the observer's location, find the first sunrise after each ingress
3. That sunrise marks day 1 of the new month
4. Days are counted from that sunrise until the next month's first sunrise

### Planetary Hours

1. Divide the time from sunrise to sunset into 12 equal day-hours
2. Divide sunset to next sunrise into 12 equal night-hours
3. Assign planets in Chaldean order (Saturn, Jupiter, Mars, Sun, Venus, Mercury, Moon)
4. The first hour of each day is ruled by the day's planet (Sunday=Sun, Monday=Moon, etc.)

### Era

| Amareth Year | Gregorian Period |
|-------------|-----------------|
| Rok 0 | March 2025 - March 2026 |
| Rok 1 A.A. | March 2026 - March 2027 |
| Rok 2 A.A. | March 2027 - March 2028 |
| Rok 5 p.A. | March 2020 - March 2021 |

## Technical details

- **Backend**: Python + Skyfield (JPL DE440s ephemeris, sub-arcsecond precision)
- **Frontend**: Vanilla JS + Meeus algorithm (~0.01 degree precision, sufficient for day-level accuracy)
- **Zodiac**: Tropical (0 degrees = vernal equinox, aligned with seasons)
- **Reference time**: UTC, with location-dependent sunrise adjustment

## License

MIT
