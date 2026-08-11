#!/usr/bin/env python3
"""Parse every migration with PostgreSQL's own parser before anyone pastes one in.

WHY THIS EXISTS

Migration 0153 was handed over with a syntax error. The generator wrote each
row's explanatory comment AFTER the values tuple:

    ('A011', 'cup', 55, 'INDB Units.xlsx')   -- 1 cup Rice flakes,

which puts the separating comma inside the comment, so Postgres sees two tuples
with nothing between them. The same mistake had been found and fixed in 0149 a
few hours earlier and was reintroduced because the fix lived in one throwaway
script rather than in a check.

It survived a bracket count, because the brackets balance perfectly. It survived
a regex that pulled out the value rows, because each row on its own is fine. The
only thing that reliably catches it is a real parser.

WHAT IT USES

pglast, which wraps libpg_query — the actual PostgreSQL grammar, not an
approximation of it. It checks syntax only: it will not tell you a column is
missing or a foreign key will fail, because it never connects to a database.
Syntax is the class of error worth catching here, since it is the one that
wastes somebody's time in the SQL editor for no reason.

    pip install pglast --break-system-packages
    python3 scripts/check-sql.py
"""

import glob
import os
import sys

try:
    from pglast import parse_sql
    from pglast.parser import ParseError
except ImportError:
    sys.exit("pglast is not installed:  pip install pglast --break-system-packages")


def main() -> int:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    files = sorted(glob.glob(os.path.join(here, "supabase", "*.sql")))
    if not files:
        print("No migrations found.")
        return 1

    bad = 0
    for path in files:
        src = open(path, encoding="utf-8").read()
        try:
            parse_sql(src)
        except ParseError as e:
            bad += 1
            # pglast puts the message and a character offset in e.args; there is
            # no named attribute for either, and reading one that does not exist
            # is how a checker crashes instead of reporting.
            msg = e.args[0] if e.args else str(e)
            offset = e.args[1] if len(e.args) > 1 and isinstance(e.args[1], int) else None
            line = src[:offset].count("\n") + 1 if offset is not None else None
            print(f"\n✗ {os.path.basename(path)}" + (f", line {line}" if line else ""))
            print(f"  {msg}")
            if line:
                lines = src.splitlines()
                for n in range(max(1, line - 2), min(len(lines), line) + 1):
                    print(f"  {n:>5} | {lines[n - 1][:110]}")
        except Exception as e:                      # noqa: BLE001 — report, do not hide
            bad += 1
            print(f"\n✗ {os.path.basename(path)}: {type(e).__name__}: {e}")

    print(f"\n{len(files) - bad} of {len(files)} migrations parse cleanly.")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
