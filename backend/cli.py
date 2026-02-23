#!/usr/bin/env python3
"""CLI tool for the Amaréth Calendar."""

import argparse
import sys
from datetime import date, datetime, timezone

from core.calendar import ZODIAC_SIGNS, ZodiacDate, format_amareth_year, from_amareth
from core.converter import (
    gregorian_to_zodiac,
    month_length,
    today_zodiac,
    year_length,
    zodiac_to_gregorian,
)
from core.ephemeris import get_ingresses_for_year


def cmd_today(args):
    """Show today's Amaréth date."""
    zd = today_zodiac()
    greg = datetime.now(timezone.utc).date()
    print(f"Dzisiaj: {zd.format_full()}")
    print(f"Gregorianski: {greg.isoformat()}")


def cmd_convert(args):
    """Convert a Gregorian date to Amaréth."""
    greg = date.fromisoformat(args.date)
    zd = gregorian_to_zodiac(greg)
    print(f"Gregorianski: {greg.isoformat()}")
    print(f"Amareth:      {zd.format_full()}")
    print(f"Krotki:       {zd.format_short()}")


def cmd_year(args):
    """Show all months of an Amaréth year."""
    year = from_amareth(args.year)
    ingresses = get_ingresses_for_year(year)

    print(f"\n  Amareth Calendar - {format_amareth_year(year)}")
    print(f"  {'=' * 55}")
    print(f"  {'Nr':>3}  {'Miesiac':<14} {'Symbol':>6}  {'Rozpoczecie':>20}  {'Dni':>4}")
    print(f"  {'-' * 55}")

    total_days = 0
    for i, ing in enumerate(ingresses):
        sign = ZODIAC_SIGNS[ing["sign_index"]]
        days = month_length(year, i + 1)
        total_days += days
        dt = datetime.fromisoformat(ing["utc_iso"])
        date_str = dt.strftime("%d %b %Y %H:%M UTC")
        print(f"  {i+1:>3}  {sign['name']:<14} {sign['symbol']:>6}  {date_str:>20}  {days:>4}")

    print(f"  {'-' * 55}")
    print(f"  {'Suma dni w roku:':<40} {total_days:>4}")
    print()


def cmd_month(args):
    """Show details of a specific Amaréth month."""
    year = from_amareth(args.year)
    month = args.month
    days = month_length(year, month)
    sign = ZODIAC_SIGNS[month - 1]

    print(f"\n  {sign['symbol']} {sign['name']} ({sign['latin']}), {format_amareth_year(year)}")
    print(f"  Dlugosc: {days} dni")
    print(f"  Dlugosc ekliptyczna: {sign['longitude_start']}deg - {sign['longitude_start'] + 30}deg")
    print()

    for day in range(1, days + 1):
        zd = ZodiacDate(year=year, month=month, day=day)
        greg = zodiac_to_gregorian(zd)
        print(f"  {day:>3} {sign['name']:<14} = {greg.isoformat()} ({greg.strftime('%A')})")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="Amareth Calendar - narzedzie CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Rok Amareth: 1 = od ingressu Barana 2026, 0 = obecny rok, -1 = poprzedni itd.

Przyklady:
  python cli.py today                    # dzisiejsza data
  python cli.py convert 2026-04-15       # konwersja daty
  python cli.py year 1                   # pokaz Rok 1 A.A.
  python cli.py year 0                   # pokaz Rok 0
  python cli.py month 1 1               # pokaz Arieneum w Roku 1
        """,
    )
    subparsers = parser.add_subparsers(dest="command", help="Dostepne komendy")

    # today
    subparsers.add_parser("today", help="Pokaz dzisiejsza date")

    # convert
    p_convert = subparsers.add_parser("convert", help="Konwertuj date gregorianska")
    p_convert.add_argument("date", help="Data w formacie YYYY-MM-DD")

    # year
    p_year = subparsers.add_parser("year", help="Pokaz wszystkie miesiace roku")
    p_year.add_argument("year", type=int, help="Rok Amareth (1 = pierwszy rok nowej ery)")

    # month
    p_month = subparsers.add_parser("month", help="Pokaz szczegoly miesiaca")
    p_month.add_argument("year", type=int, help="Rok Amareth")
    p_month.add_argument("month", type=int, choices=range(1, 13), help="Numer miesiaca (1-12)")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    commands = {
        "today": cmd_today,
        "convert": cmd_convert,
        "year": cmd_year,
        "month": cmd_month,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
