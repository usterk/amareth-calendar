"""Astronomical calculations for zodiac calendar using Skyfield."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from skyfield.api import load
from skyfield.framelib import ecliptic_frame
from skyfield import almanac


DATA_DIR = Path(__file__).parent.parent / "data"
CACHE_FILE = DATA_DIR / "ingress_cache.json"

# Lazy-loaded globals
_ts = None
_eph = None
_earth = None
_sun = None


def _init_skyfield():
    """Initialize Skyfield objects (lazy, cached)."""
    global _ts, _eph, _earth, _sun
    if _ts is None:
        _ts = load.timescale()
        _eph = load("de440s.bsp")
        _earth = _eph["earth"]
        _sun = _eph["sun"]


def sun_longitude_at(dt: datetime) -> float:
    """Get the Sun's ecliptic longitude in degrees at a given UTC datetime.

    Returns a value in [0, 360).
    """
    _init_skyfield()
    t = _ts.from_datetime(dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt)
    astrometric = _earth.at(t).observe(_sun).apparent()
    _, lon, _ = astrometric.frame_latlon(ecliptic_frame)
    return lon.degrees % 360


def compute_ingresses(year: int) -> list[dict]:
    """Compute the 12 solar ingress moments for a zodiac year starting at Aries.

    A zodiac year starts when the Sun enters Aries (0 deg) around March 20.
    Returns a list of 12 dicts with keys: sign_index, longitude, utc_iso, utc_datetime.
    The list covers from the Aries ingress of `year` through Pisces.
    """
    _init_skyfield()

    def zodiac_sign_at(t):
        e = _earth.at(t)
        _, slon, _ = e.observe(_sun).apparent().frame_latlon(ecliptic_frame)
        return (slon.degrees // 30).astype(int) % 12

    zodiac_sign_at.step_days = 25

    # Search from Feb 1 of the given year to Apr 1 of the next year
    # to capture all 12 ingresses of one zodiac year
    t0 = _ts.utc(year, 2, 1)
    t1 = _ts.utc(year + 1, 4, 1)

    times, signs = almanac.find_discrete(t0, t1, zodiac_sign_at)

    ingresses = []
    seen_aries = False

    for t, sign_index in zip(times, signs):
        sign_index = int(sign_index)

        # Start collecting from Aries (sign 0)
        if sign_index == 0 and not seen_aries:
            seen_aries = True

        if not seen_aries:
            continue

        dt = t.utc_datetime()
        ingresses.append({
            "sign_index": sign_index,
            "longitude": sign_index * 30,
            "utc_iso": dt.isoformat(),
            "utc_datetime": dt,
        })

        # Stop after collecting all 12 signs
        if len(ingresses) == 12:
            break

    return ingresses


def compute_ingresses_range(start_year: int, end_year: int) -> dict:
    """Compute ingress tables for a range of years.

    Returns a dict keyed by year, each containing a list of 12 ingress entries.
    The utc_datetime field is excluded (not JSON-serializable).
    """
    result = {}
    for year in range(start_year, end_year + 1):
        ingresses = compute_ingresses(year)
        result[str(year)] = [
            {
                "sign_index": ing["sign_index"],
                "longitude": ing["longitude"],
                "utc_iso": ing["utc_iso"],
            }
            for ing in ingresses
        ]
    return result


def load_ingress_cache() -> Optional[dict]:
    """Load pre-computed ingress cache from JSON file."""
    if not CACHE_FILE.exists():
        return None
    with open(CACHE_FILE) as f:
        return json.load(f)


def save_ingress_cache(data: dict) -> None:
    """Save ingress cache to JSON file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        json.dump(data, f, indent=2)


def get_ingresses_for_year(year: int) -> list[dict]:
    """Get ingresses for a year, using cache if available, computing otherwise."""
    cache = load_ingress_cache()
    year_str = str(year)

    if cache and year_str in cache:
        entries = cache[year_str]
        # Parse ISO dates back to datetime objects
        for entry in entries:
            entry["utc_datetime"] = datetime.fromisoformat(entry["utc_iso"])
        return entries

    # Compute and optionally update cache
    ingresses = compute_ingresses(year)
    serializable = [
        {
            "sign_index": ing["sign_index"],
            "longitude": ing["longitude"],
            "utc_iso": ing["utc_iso"],
        }
        for ing in ingresses
    ]

    if cache is None:
        cache = {}
    cache[year_str] = serializable
    save_ingress_cache(cache)

    return ingresses
