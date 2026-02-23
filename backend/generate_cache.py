#!/usr/bin/env python3
"""Pre-compute solar ingress dates and save to cache."""

import argparse
import sys
import time

from core.ephemeris import compute_ingresses_range, save_ingress_cache


def main():
    parser = argparse.ArgumentParser(description="Generate ingress cache for zodiac calendar")
    parser.add_argument("--start", type=int, default=2000, help="Start year (default: 2000)")
    parser.add_argument("--end", type=int, default=2100, help="End year (default: 2100)")
    args = parser.parse_args()

    print(f"Computing ingress dates for {args.start}-{args.end}...")
    print("(This downloads ephemeris data on first run and may take a minute)")

    start_time = time.time()
    data = compute_ingresses_range(args.start, args.end)
    elapsed = time.time() - start_time

    save_ingress_cache(data)

    total_entries = sum(len(v) for v in data.values())
    print(f"Done! {len(data)} years, {total_entries} ingress entries")
    print(f"Time: {elapsed:.1f}s")
    print(f"Saved to data/ingress_cache.json")


if __name__ == "__main__":
    main()
