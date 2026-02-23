"""Tests for zodiac calendar day/month/year boundaries.

Verifies that both start and end of each month are correct,
round-trip conversions work, and edge cases are handled.
"""

import pytest
from datetime import date, timedelta

from core.calendar import ZodiacDate, ZODIAC_SIGNS
from core.converter import (
    gregorian_to_zodiac,
    zodiac_to_gregorian,
    month_length,
    year_length,
    _get_ingress_dates_for_zodiac_year,
)


# ========== Reference data: 2026 ingress dates (UTC date portion) ==========
# From Skyfield computation, verified against astronomical references.
INGRESSES_2026 = {
    1: date(2026, 3, 20),   # Arieneum (Aries 0°)    14:45 UTC
    2: date(2026, 4, 20),   # Taureneum (Taurus 30°)  01:39 UTC
    3: date(2026, 5, 21),   # Geminion (Gemini 60°)   00:36 UTC
    4: date(2026, 6, 21),   # Cancerion (Cancer 90°)  08:24 UTC
    5: date(2026, 7, 22),   # Leon (Leo 120°)         19:13 UTC
    6: date(2026, 8, 23),   # Virgeon (Virgo 150°)    02:18 UTC
    7: date(2026, 9, 23),   # Libreon (Libra 180°)    00:05 UTC
    8: date(2026, 10, 23),  # Scorpion (Scorpio 210°) 09:37 UTC
    9: date(2026, 11, 22),  # Sagittarion (Sag. 240°) 07:23 UTC
    10: date(2026, 12, 21), # Caprineum (Cap. 270°)   20:50 UTC
    11: date(2027, 1, 20),  # Aquarion (Aqu. 300°)    07:29 UTC
    12: date(2027, 2, 18),  # Piscion (Pisces 330°)   21:33 UTC
}


class TestFirstDayOfMonth:
    """The ingress date should be day 1 of its zodiac month."""

    @pytest.mark.parametrize("month_num,greg_date", list(INGRESSES_2026.items()))
    def test_ingress_date_is_day_one(self, month_num, greg_date):
        zd = gregorian_to_zodiac(greg_date)
        assert zd.year == 2026
        assert zd.month == month_num
        assert zd.day == 1, f"Ingress {greg_date} should be day 1 of month {month_num}, got day {zd.day}"


class TestLastDayOfMonth:
    """The day before the next ingress should be the last day of the previous month."""

    @pytest.mark.parametrize("month_num", range(1, 12))
    def test_day_before_next_ingress(self, month_num):
        next_ingress = INGRESSES_2026[month_num + 1]
        last_day_greg = next_ingress - timedelta(days=1)
        zd = gregorian_to_zodiac(last_day_greg)
        expected_length = month_length(2026, month_num)
        assert zd.year == 2026
        assert zd.month == month_num
        assert zd.day == expected_length, (
            f"Day before month {month_num+1} ingress should be day {expected_length} of month {month_num}, "
            f"got day {zd.day}"
        )

    def test_last_day_of_piscion(self):
        """Last month (Piscion) ends at next year's Aries ingress."""
        ingresses_2027 = _get_ingress_dates_for_zodiac_year(2027)
        next_aries = ingresses_2027[0][0]  # date of Aries 2027
        last_day = next_aries - timedelta(days=1)
        zd = gregorian_to_zodiac(last_day)
        assert zd.year == 2026
        assert zd.month == 12  # Piscion
        assert zd.day == month_length(2026, 12)


class TestMonthTransitions:
    """Going from the last day of month N to the first day of month N+1."""

    @pytest.mark.parametrize("month_num", range(1, 12))
    def test_consecutive_days_cross_month(self, month_num):
        ingress = INGRESSES_2026[month_num + 1]
        day_before = ingress - timedelta(days=1)

        zd_before = gregorian_to_zodiac(day_before)
        zd_ingress = gregorian_to_zodiac(ingress)

        assert zd_before.month == month_num
        assert zd_ingress.month == month_num + 1
        assert zd_ingress.day == 1


class TestYearBoundary:
    """Tests for zodiac year transitions."""

    def test_day_before_aries_is_previous_year(self):
        """March 19, 2026 should be in zodiac year 2025."""
        aries_2026 = INGRESSES_2026[1]
        day_before = aries_2026 - timedelta(days=1)
        zd = gregorian_to_zodiac(day_before)
        assert zd.year == 2025
        assert zd.month == 12  # Piscion of 2025

    def test_aries_ingress_is_new_year(self):
        """The Aries ingress date is day 1, month 1 of the new zodiac year."""
        zd = gregorian_to_zodiac(INGRESSES_2026[1])
        assert zd.year == 2026
        assert zd.month == 1
        assert zd.day == 1

    def test_january_is_still_previous_zodiac_year(self):
        """January 15, 2026 is in zodiac year 2025 (before Aries ingress)."""
        zd = gregorian_to_zodiac(date(2026, 1, 15))
        assert zd.year == 2025

    def test_december_after_capricorn_ingress(self):
        """December 25, 2026 is in zodiac year 2026, month Caprineum."""
        zd = gregorian_to_zodiac(date(2026, 12, 25))
        assert zd.year == 2026
        assert zd.month == 10  # Caprineum


class TestRoundTrip:
    """Gregorian → Zodiac → Gregorian should be identity."""

    @pytest.mark.parametrize("greg_date", [
        date(2026, 3, 20),   # Aries ingress
        date(2026, 4, 15),   # mid-Arieneum
        date(2026, 6, 21),   # Cancer ingress
        date(2026, 7, 4),    # mid-Cancerion
        date(2026, 9, 22),   # Libra ingress (equinox)
        date(2026, 12, 21),  # Capricorn ingress (solstice)
        date(2027, 1, 15),   # Aquarion
        date(2027, 3, 19),   # Last day of Piscion 2026
        date(2026, 1, 1),    # New Year (zodiac year 2025)
        date(2026, 3, 19),   # Day before Aries ingress 2026
    ])
    def test_greg_to_zodiac_to_greg(self, greg_date):
        zd = gregorian_to_zodiac(greg_date)
        result = zodiac_to_gregorian(zd)
        assert result == greg_date, f"Round-trip failed: {greg_date} → {zd} → {result}"

    @pytest.mark.parametrize("year,month,day", [
        (2026, 1, 1),    # 1 Arieneum
        (2026, 1, 31),   # 31 Arieneum
        (2026, 6, 15),   # 15 Libreon
        (2026, 12, 1),   # 1 Piscion
        (2025, 12, 30),  # 30 Piscion 2025
    ])
    def test_zodiac_to_greg_to_zodiac(self, year, month, day):
        zd = ZodiacDate(year=year, month=month, day=day)
        greg = zodiac_to_gregorian(zd)
        result = gregorian_to_zodiac(greg)
        assert result.year == year
        assert result.month == month
        assert result.day == day


class TestMonthLengths:
    """Month lengths should be reasonable and sum to 365 or 366."""

    @pytest.mark.parametrize("year", [2024, 2025, 2026, 2027, 2028])
    def test_year_length_is_365_or_366(self, year):
        total = year_length(year)
        assert total in (365, 366), f"Year {year} has {total} days"

    @pytest.mark.parametrize("year", [2025, 2026, 2027])
    def test_all_months_have_reasonable_length(self, year):
        for m in range(1, 13):
            days = month_length(year, m)
            assert 29 <= days <= 32, f"Year {year}, month {m} has {days} days"

    def test_month_lengths_sum_to_year_length(self):
        for year in range(2024, 2030):
            total = sum(month_length(year, m) for m in range(1, 13))
            assert total == year_length(year)


class TestContinuousCoverage:
    """Every Gregorian day should map to exactly one zodiac date with no gaps."""

    def test_no_gaps_in_zodiac_year_2026(self):
        """Walk every day from Aries 2026 to Aries 2027, verify contiguous zodiac days."""
        start = INGRESSES_2026[1]
        ingresses_2027 = _get_ingress_dates_for_zodiac_year(2027)
        end = ingresses_2027[0][0]

        prev_zd = None
        current = start
        while current < end:
            zd = gregorian_to_zodiac(current)
            assert zd.year == 2026

            if prev_zd is not None:
                # Either same month next day, or day 1 of next month
                if zd.month == prev_zd.month:
                    assert zd.day == prev_zd.day + 1, (
                        f"Gap at {current}: {prev_zd} → {zd}"
                    )
                else:
                    assert zd.month == prev_zd.month + 1, (
                        f"Skipped month at {current}: {prev_zd} → {zd}"
                    )
                    assert zd.day == 1, (
                        f"New month doesn't start at day 1: {current} → {zd}"
                    )

            prev_zd = zd
            current += timedelta(days=1)


class TestEdgeCases:
    """Invalid inputs and boundary conditions."""

    def test_invalid_month_raises(self):
        with pytest.raises(ValueError):
            zodiac_to_gregorian(ZodiacDate(2026, 0, 1))

    def test_invalid_month_13_raises(self):
        with pytest.raises(ValueError):
            zodiac_to_gregorian(ZodiacDate(2026, 13, 1))

    def test_day_beyond_month_raises(self):
        with pytest.raises(ValueError):
            zodiac_to_gregorian(ZodiacDate(2026, 1, 40))

    def test_month_length_invalid_month(self):
        with pytest.raises(ValueError):
            month_length(2026, 0)
        with pytest.raises(ValueError):
            month_length(2026, 13)


class TestMultipleYears:
    """Verify boundaries across several years."""

    @pytest.mark.parametrize("year", range(2020, 2030))
    def test_year_starts_correctly(self, year):
        ingresses = _get_ingress_dates_for_zodiac_year(year)
        aries_date = ingresses[0][0]
        zd = gregorian_to_zodiac(aries_date)
        assert zd.year == year
        assert zd.month == 1
        assert zd.day == 1

    @pytest.mark.parametrize("year", range(2020, 2030))
    def test_year_end_transitions_to_next(self, year):
        next_ingresses = _get_ingress_dates_for_zodiac_year(year + 1)
        next_aries = next_ingresses[0][0]
        # Last day of this zodiac year
        last_day = next_aries - timedelta(days=1)
        zd_last = gregorian_to_zodiac(last_day)
        assert zd_last.year == year
        assert zd_last.month == 12
        # First day of next zodiac year
        zd_first = gregorian_to_zodiac(next_aries)
        assert zd_first.year == year + 1
        assert zd_first.month == 1
        assert zd_first.day == 1
