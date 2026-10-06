import argparse
from datetime import date
from acquisition_report import get_report

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sir Fisher: acquisition and outcomes")
    parser.add_argument("--days", type=int, default=30)
    parser.add_argument("--end-date", type=date.fromisoformat)
    parser.add_argument("--hostname", default="www.sirfisher.com.br")
    parser.add_argument("--no-search", action="store_true")
    parser.add_argument("--operations", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.days <= 366:
        parser.error("--days must be between 1 and 366")
    get_report(args.days, args.end_date, args.hostname, not args.no_search, args.operations)
