"""Convert between Gregorian and Zodiac calendar dates."""

from bisect import bisect_right
from datetime import date, datetime, timezone

from .calendar import ZodiacDate
from .ephemeris import get_ingresses_for_year


def _get_ingress_dates_for_zodiac_year(zodiac_year: int) -> list[tuple[date, int]]:
    """Get ingress dates as (date, sign_index) for a zodiac year.

    A zodiac year spans from Aries ingress of `zodiac_year` to the next Aries ingress.
    Returns 12 entries sorted by date.
    """
    ingresses = get_ingresses_for_year(zodiac_year)
    result = []
    for ing in ingresses:
        dt = datetime.fromisoformat(ing["utc_iso"]) if isinstance(ing["utc_iso"], str) else ing["utc_iso"]
        # Use UTC date as the calendar date
        result.append((dt.date() if hasattr(dt, 'date') else dt, ing["sign_index"]))
    return result


def _find_zodiac_year_for_gregorian(greg_date: date) -> int:
    """Determine which zodiac year a Gregorian date falls in.

    The zodiac year N starts at the Aries ingress of Gregorian year N
    (around March 20). Dates before that in the same Gregorian year
    belong to zodiac year N-1.
    """
    # Get Aries ingress for the Gregorian year
    ingresses = get_ingresses_for_year(greg_date.year)
    aries_ingress_iso = ingresses[0]["utc_iso"]
    aries_date = datetime.fromisoformat(aries_ingress_iso).date()

    if greg_date >= aries_date:
        return greg_date.year
    else:
        return greg_date.year - 1


def gregorian_to_zodiac(greg_date: date) -> ZodiacDate:
    """Convert a Gregorian date to a Zodiac calendar date."""
    zodiac_year = _find_zodiac_year_for_gregorian(greg_date)
    ingress_dates = _get_ingress_dates_for_zodiac_year(zodiac_year)

    dates_only = [d for d, _ in ingress_dates]

    # Find which month the date falls in
    idx = bisect_right(dates_only, greg_date) - 1

    if idx < 0:
        # Before the first ingress - shouldn't happen if zodiac_year is correct
        raise ValueError(f"Date {greg_date} is before the zodiac year {zodiac_year}")

    month_start_date, sign_index = ingress_dates[idx]
    day = (greg_date - month_start_date).days + 1
    month = sign_index + 1  # 1-based month

    return ZodiacDate(year=zodiac_year, month=month, day=day)


def zodiac_to_gregorian(zodiac_date: ZodiacDate) -> date:
    """Convert a Zodiac calendar date to a Gregorian date."""
    ingress_dates = _get_ingress_dates_for_zodiac_year(zodiac_date.year)

    # Find the ingress for this month
    month_idx = zodiac_date.month - 1
    if month_idx < 0 or month_idx >= len(ingress_dates):
        raise ValueError(f"Invalid zodiac month: {zodiac_date.month}")

    month_start_date, _ = ingress_dates[month_idx]

    from datetime import timedelta
    result = month_start_date + timedelta(days=zodiac_date.day - 1)

    # Validate the day is within this month
    if month_idx + 1 < len(ingress_dates):
        next_month_start, _ = ingress_dates[month_idx + 1]
        if result >= next_month_start:
            raise ValueError(
                f"Day {zodiac_date.day} is beyond the length of "
                f"{zodiac_date.month_name} in zodiac year {zodiac_date.year}"
            )

    return result


def today_zodiac() -> ZodiacDate:
    """Get today's date in the Zodiac calendar (UTC)."""
    return gregorian_to_zodiac(datetime.now(timezone.utc).date())


def month_length(zodiac_year: int, month: int) -> int:
    """Get the number of days in a zodiac month.

    Args:
        zodiac_year: The zodiac year.
        month: Month number (1-12).
    """
    ingress_dates = _get_ingress_dates_for_zodiac_year(zodiac_year)
    month_idx = month - 1

    if month_idx < 0 or month_idx >= len(ingress_dates):
        raise ValueError(f"Invalid zodiac month: {month}")

    start_date, _ = ingress_dates[month_idx]

    if month_idx + 1 < len(ingress_dates):
        end_date, _ = ingress_dates[month_idx + 1]
    else:
        # Last month (Piscion) - ends at the Aries ingress of next year
        next_year_ingresses = _get_ingress_dates_for_zodiac_year(zodiac_year + 1)
        end_date, _ = next_year_ingresses[0]

    return (end_date - start_date).days


def year_length(zodiac_year: int) -> int:
    """Get the total number of days in a zodiac year."""
    return sum(month_length(zodiac_year, m) for m in range(1, 13))
