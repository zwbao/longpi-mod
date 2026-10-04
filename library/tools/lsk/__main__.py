"""Command line for the longevity-skills repository tools.

    python3 -m tools.lsk check                 # all consistency checks CI runs (no skill tests)
    python3 -m tools.lsk test [NAME ...]       # skill tests, one process per skill
    python3 -m tools.lsk test --changed [BASE] # only skills changed since BASE (default origin/main)
    python3 -m tools.lsk build                 # regenerate catalog.json, README list, legacy registry, vendored files
    python3 -m tools.lsk catalog [--check]
    python3 -m tools.lsk readme [--check]
    python3 -m tools.lsk registry [--check] [--write-legacy] [--sync]
    python3 -m tools.lsk upsert-paper --doi DOI --tier A|B|C --outcome skill|evidence|indexed|rejected|pending [...]
    python3 -m tools.lsk vendor sync|check
    python3 -m tools.lsk fmt                   # rewrite every skill.json in canonical key order
    python3 -m tools.lsk doi TEXT              # print the normalized DOI
    python3 -m tools.lsk crossref DOI          # print Crossref metadata (cached)
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import List

from . import catalog, datasets, evidence, manifest, readme, registry, testrun, vendor
from .common import CATALOG, README, dump_json, read_json, write_json
from .doi import normalize_doi


def _report(errors: List[str], label: str) -> int:
    if errors:
        print(f"{label}: {len(errors)} problem(s)")
        for line in errors:
            print(f"  - {line}")
        return 1
    print(f"{label}: ok")
    return 0


def cmd_catalog(check: bool) -> int:
    manifests, errors = manifest.check_all()
    if errors:
        return _report(errors, "skill.json")
    built = catalog.build(manifests)
    if check:
        current = read_json(CATALOG) if CATALOG.exists() else None
        return _report([] if current == built else ["catalog.json is stale (run: python3 -m tools.lsk catalog)"], "catalog.json")
    changed = write_json(CATALOG, built)
    print(f"catalog.json {'written' if changed else 'unchanged'}: {built['counts']}")
    return 0


def cmd_readme(check: bool) -> int:
    manifests = manifest.load_all()
    text = README.read_text(encoding="utf-8")
    new = readme.splice(text, readme.render_list(manifests))
    if check:
        return _report([] if new == text else ["README.md skill list is stale (run: python3 -m tools.lsk readme)"], "README.md")
    if new != text:
        README.write_text(new, encoding="utf-8")
        print("README.md skill list written")
    else:
        print("README.md unchanged")
    return 0


def cmd_check() -> int:
    manifests, errors = manifest.check_all()
    status = _report(errors, "skill.json")
    status |= _report(registry.check(manifests) + registry.check_legacy(), "registry")
    status |= _report(evidence.check(manifests), "skills/longevity-evidence/data/claims.jsonl")
    status |= _report(vendor.check(), "vendored files")
    status |= _report(vendor.check_cards(), "paper cards")
    status |= _report(datasets.check_biovar(), "data/biological_variation.json")
    status |= _report(datasets.check_effects(), "data/effects.jsonl")
    if not errors:
        status |= cmd_catalog(check=True)
    status |= cmd_readme(check=True)
    return status


def cmd_build() -> int:
    changed = vendor.sync()
    print(f"vendored files updated: {len(changed)}")
    registry.write_legacy()
    status = cmd_catalog(check=False)
    status |= cmd_readme(check=False)
    return status


def cmd_fmt() -> int:
    count = 0
    for name, data in manifest.load_all().items():
        from .common import SKILLS
        if manifest.save(SKILLS / name, data):
            count += 1
    rows = registry.load()
    registry.save(rows)
    print(f"skill.json rewritten: {count}")
    return 0


def main(argv: List[str] = None) -> int:
    parser = argparse.ArgumentParser(prog="python3 -m tools.lsk", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("check")
    test = sub.add_parser("test")
    test.add_argument("names", nargs="*")
    test.add_argument("--changed", nargs="?", const="origin/main", default=None, metavar="BASE",
                      help="test only skills with changes since BASE (default origin/main), plus tools/tests when tools changed")
    test.add_argument("--jobs", type=int, default=8)
    test.add_argument("--timeout", type=int, default=300)
    sub.add_parser("build")
    for name in ("catalog", "readme"):
        item = sub.add_parser(name)
        item.add_argument("--check", action="store_true")
    reg = sub.add_parser("registry")
    reg.add_argument("--check", action="store_true")
    reg.add_argument("--write-legacy", action="store_true")
    reg.add_argument("--sync", action="store_true", help="refresh skill rows from skill.json")
    up = sub.add_parser("upsert-paper", help="add or update one registry row (used by the weekly pipeline)")
    up.add_argument("--doi", required=True)
    up.add_argument("--tier", required=True, choices=["A", "B", "C", "tool", "pending", "rejected"])
    up.add_argument("--outcome", required=True, choices=["skill", "evidence", "indexed", "rejected", "pending"])
    up.add_argument("--skill", default="")
    up.add_argument("--title", default="")
    up.add_argument("--journal", default="")
    up.add_argument("--year", type=int, default=0)
    up.add_argument("--reason", default="")
    up.add_argument("--source", default="pipeline", choices=["seed", "pipeline", "manual"])
    vend = sub.add_parser("vendor")
    vend.add_argument("action", choices=["sync", "check"])
    sub.add_parser("fmt")
    doi = sub.add_parser("doi")
    doi.add_argument("text")
    cross = sub.add_parser("crossref")
    cross.add_argument("doi")
    args = parser.parse_args(argv)

    if args.command == "check":
        return cmd_check()
    if args.command == "test":
        if args.changed is not None:
            names, tools_changed = testrun.changed_skills(args.changed)
            if not names and not tools_changed:
                print(f"no skill changed since {args.changed}")
                return 0
            return testrun.run(names, jobs=args.jobs, timeout=args.timeout, tools=tools_changed, only=True)
        return testrun.run(args.names, jobs=args.jobs, timeout=args.timeout)
    if args.command == "build":
        return cmd_build()
    if args.command == "catalog":
        return cmd_catalog(args.check)
    if args.command == "readme":
        return cmd_readme(args.check)
    if args.command == "registry":
        if args.sync:
            print(f"registry rows refreshed: {registry.sync_from_manifests(manifest.load_all())}")
            registry.write_legacy()
        if args.write_legacy:
            registry.write_legacy()
        manifests = manifest.load_all()
        return _report(registry.check(manifests) + registry.check_legacy(), "registry")
    if args.command == "upsert-paper":
        rows = registry.load()
        row = {"doi": args.doi, "tier": args.tier, "outcome": args.outcome, "skill": args.skill, "title": args.title,
               "journal": args.journal, "year": args.year or None, "reason_zh": args.reason, "source": args.source}
        saved, created = registry.upsert(rows, {key: value for key, value in row.items() if value not in ("", None)}, source=args.source)
        registry.save(rows)
        print(f"{'added' if created else 'updated'} {saved['doi']}")
        return 0
    if args.command == "vendor":
        if args.action == "sync":
            changed = vendor.sync()
            print(f"vendored files updated: {len(changed)}")
            return 0
        return _report(vendor.check(), "vendored files")
    if args.command == "fmt":
        return cmd_fmt()
    if args.command == "doi":
        print(normalize_doi(args.text))
        return 0
    if args.command == "crossref":
        from .crossref import lookup
        sys.stdout.write(dump_json(lookup(args.doi)))
        return 0
    return 2


if __name__ == "__main__":
    sys.exit(main())
