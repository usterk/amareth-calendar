from dataclasses import dataclass
from typing import Optional


# Amaréth Calendar
# Amaréth year 1 starts at the Aries ingress of Gregorian year 2026 (~March 20, 2026)
# Amaréth year 0 = zodiac year 2025 (the era before)
AMARETH_EPOCH = 2025  # zodiac year 2025 = Amaréth year 0


def to_amareth(zodiac_year: int) -> int:
    """Convert internal zodiac year to Amaréth era year."""
    return zodiac_year - AMARETH_EPOCH


def from_amareth(amareth_year: int) -> int:
    """Convert Amaréth era year to internal zodiac year."""
    return amareth_year + AMARETH_EPOCH


def format_amareth_year(zodiac_year: int) -> str:
    """Format a zodiac year as Amaréth era string."""
    a = to_amareth(zodiac_year)
    if a > 0:
        return f"Rok {a} A.A."
    if a == 0:
        return "Rok 0"
    return f"Rok {abs(a)} p.A."


ZODIAC_SIGNS = [
    {"index": 0, "name": "Arieneum", "symbol": "\u2648", "latin": "Aries", "longitude_start": 0},
    {"index": 1, "name": "Taureneum", "symbol": "\u2649", "latin": "Taurus", "longitude_start": 30},
    {"index": 2, "name": "Geminion", "symbol": "\u264a", "latin": "Gemini", "longitude_start": 60},
    {"index": 3, "name": "Cancerion", "symbol": "\u264b", "latin": "Cancer", "longitude_start": 90},
    {"index": 4, "name": "Leon", "symbol": "\u264c", "latin": "Leo", "longitude_start": 120},
    {"index": 5, "name": "Virgeon", "symbol": "\u264d", "latin": "Virgo", "longitude_start": 150},
    {"index": 6, "name": "Libreon", "symbol": "\u264e", "latin": "Libra", "longitude_start": 180},
    {"index": 7, "name": "Scorpion", "symbol": "\u264f", "latin": "Scorpio", "longitude_start": 210},
    {"index": 8, "name": "Sagittarion", "symbol": "\u2650", "latin": "Sagittarius", "longitude_start": 240},
    {"index": 9, "name": "Caprineum", "symbol": "\u2651", "latin": "Capricorn", "longitude_start": 270},
    {"index": 10, "name": "Aquarion", "symbol": "\u2652", "latin": "Aquarius", "longitude_start": 300},
    {"index": 11, "name": "Piscion", "symbol": "\u2653", "latin": "Pisces", "longitude_start": 330},
]

MONTH_NAMES = [s["name"] for s in ZODIAC_SIGNS]


@dataclass
class ZodiacDate:
    year: int      # Zodiac year (starts at Arieneum/Aries ingress)
    month: int     # 1-12 (1=Arieneum, 12=Piscion)
    day: int       # Day within the month (1-based)

    @property
    def month_name(self) -> str:
        return ZODIAC_SIGNS[self.month - 1]["name"]

    @property
    def sign_symbol(self) -> str:
        return ZODIAC_SIGNS[self.month - 1]["symbol"]

    @property
    def sign_latin(self) -> str:
        return ZODIAC_SIGNS[self.month - 1]["latin"]

    @property
    def amareth_year(self) -> int:
        return to_amareth(self.year)

    def __str__(self) -> str:
        return f"{self.day} {self.month_name} {self.sign_symbol}, {format_amareth_year(self.year)}"

    def __repr__(self) -> str:
        return f"ZodiacDate(year={self.year}, month={self.month}, day={self.day})"

    def format_short(self) -> str:
        return f"{self.day:02d}.{self.month:02d}.{to_amareth(self.year)}"

    def format_full(self) -> str:
        return f"{self.day} {self.month_name} ({self.sign_symbol} {self.sign_latin}), {format_amareth_year(self.year)}"
