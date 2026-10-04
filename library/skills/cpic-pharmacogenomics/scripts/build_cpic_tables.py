#!/usr/bin/env python3
"""Rebuild ../data/cpic_tables.json from the CPIC database API.

Not run at report time. The report reads the snapshot only.

    python3 build_cpic_tables.py --raw RAW_DIR [--fetch] [--accessed YYYY-MM-DD]

--fetch downloads the CPIC tables into RAW_DIR first (api.cpicpgx.org,
PostgREST). Without it the JSON files already in RAW_DIR are used. CPIC curated
content is CC0 1.0 (see ../data/LICENSE-CPIC.md).

The snapshot keeps CPIC's own words (allele function, phenotype lookup keys,
recommendation text, classification strength, row id and version) and adds one
field per recommendation row: a category from category_for() below. The
category is how the report words the row; the CPIC text itself, which contains
doses, is never printed.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from presets import ARRAY_PANEL, DRUGS, GUIDELINE_DOI, GUIDELINE_IDS, SKIP_POPULATIONS, WARFARIN_SITES  # noqa: E402

API = "https://api.cpicpgx.org/v1/"
OUT = HERE.parent / "data" / "cpic_tables.json"

# Genes whose CPIC allele function table is kept for --diplotypes input.
CLINICAL_GENES = ["CYP2C19", "CYP2C9", "CYP2D6", "TPMT", "NUDT15", "DPYD", "CYP3A5", "SLCO1B1", "ABCG2"]
LOOKUP_GENES = CLINICAL_GENES + ["HLA-A", "HLA-B"]
ACTIVITY_GENES = {"CYP2C9", "CYP2D6", "DPYD"}


def _get(path: str, tries: int = 6) -> Any:
    for attempt in range(tries):
        try:
            request = urllib.request.Request(API + path, headers={"User-Agent": "longevity-skills", "Accept": "application/json"})
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.loads(response.read())
        except Exception as error:  # network is flaky; retry
            print(f"retry {attempt}: {path[:80]}: {error}", file=sys.stderr)
            time.sleep(3)
    raise SystemExit(f"could not fetch {path}")


def fetch(raw: Path) -> None:
    raw.mkdir(parents=True, exist_ok=True)
    genes = sorted(set(CLINICAL_GENES) | set(WARFARIN_SITES))
    tables: Dict[str, List[Any]] = collections.defaultdict(list)
    for name in ("guideline", "drug", "publication", "gene_result", "gene_result_lookup", "allele"):
        tables[name] = _get(name)
    for gid in GUIDELINE_IDS:
        tables["recommendation"] += _get(f"recommendation?guidelineid=eq.{gid}")
    for gene in genes:
        tables["sequence_location"] += _get(f"sequence_location?genesymbol=eq.{gene}")
        tables["allele_definition"] += _get(f"allele_definition?genesymbol=eq.{gene}")
    ids = [item["id"] for item in tables["allele_definition"]]
    for start in range(0, len(ids), 60):
        chunk = ",".join(str(item) for item in ids[start:start + 60])
        tables["allele_location_value"] += _get(f"allele_location_value?alleledefinitionid=in.({chunk})")
    tables["change_log"] = _get("change_log?order=date.desc&limit=1")
    for name, rows in tables.items():
        (raw / f"{name}.json").write_text(json.dumps(rows), encoding="utf-8")


# ---------------------------------------------------------------------------
# Category rule. Applied to the first sentence of CPIC's drugrecommendation.
# ---------------------------------------------------------------------------

NONE_START = ("no recommendation", "n/a", "no action recommended", "neither tpmt or nudt15")
AVOID_PATTERNS = [
    r"^avoid (?!moderate and strong cyp2d6 inhibitors)",
    r"\bis contraindicated\b",
    r"\bdo not use\b",
    r"^(prescribe|choose|select|recommend) (an )?alternative",
    r"^consider (an )?alternative",
    r"^consider a clinically appropriate (alternative )?antidepressant",
    r"^consider hormonal therapy such as an aromatase inhibitor",
]
STANDARD_PATTERNS = [
    r"^initiate therapy with recommended starting dose\.?$",
    r"^initiate therapy with recommended standard of care dosing",
    r"^initiate therapy with standard recommended dose",
    r"^initiate standard dosing",
    r"^initiate standard starting daily dose",
    r"^(based on (tpmt|nudt15), )?initiate therapy with standard starting dose",
    r"^if considering clopidogrel, use at standard dose",
    r"^use \w+ label recommended",
    r"^use \w+ per standard dosing guidelines",
    r"^no adjustments needed from typical dosing strategies",
    r"^(based on (slco1b1|abcg2|cyp2c9) status, )?prescribe desired starting dose",
    r"^based on genotype, there is no indication to change dose or therapy",
    r"^avoid moderate and strong cyp2d6 inhibitors",
]
# Later sentences that turn a standard start into "adjust or monitor".
CAUTION_LATER = [
    r"slower titration",
    r"lower maintenance dose",
    r"aware of possible increased risk",
    r"titrate dose to therapeutic trough",
]
# Not in the list: indication-specific options after a standard start, such as
# the PPI rows "Consider increasing dose by 50-100% for the treatment of H.
# pylori infection..." (normal and rapid metabolizers) and "For chronic therapy
# (>12 weeks)... consider 50% reduction" (intermediate and poor metabolizers).
# Both stay standard, as their first sentence says.


def first_sentence(text: str) -> str:
    text = " ".join((text or "").split())
    match = re.match(r"(.+?[.;])(\s|$)", text)
    return (match.group(1) if match else text).rstrip(".;").strip()


def category_for(text: str) -> str:
    """avoid, caution, standard or none, from CPIC's recommendation text.

    The first sentence decides: no recommendation -> none; avoid, contraindicated,
    do not use, or choose/select/consider an alternative -> avoid; a plain
    standard start -> standard unless a later sentence asks for slower
    titration, a lower maintenance dose, awareness of myopathy risk or trough
    titration; anything else (reduce, increase, a capped or
    percentage starting dose, drastically reduced) -> caution.
    """
    full = " ".join((text or "").split()).casefold()
    head = first_sentence(text).casefold()
    if not head or head.startswith(NONE_START):
        return "none"
    if any(re.search(pattern, head) for pattern in AVOID_PATTERNS):
        return "avoid"
    if any(re.search(pattern, head) for pattern in STANDARD_PATTERNS):
        rest = full[len(head):]
        if any(re.search(pattern, rest) for pattern in CAUTION_LATER):
            return "caution"
        return "standard"
    return "caution"


# ---------------------------------------------------------------------------


def _load(raw: Path, name: str) -> List[Dict[str, Any]]:
    return json.loads((raw / f"{name}.json").read_text(encoding="utf-8"))


def _population(label: Optional[str]) -> str:
    return " ".join((label or "general").split())


def build(raw: Path, accessed: str) -> Dict[str, Any]:
    definitions = {item["id"]: item for item in _load(raw, "allele_definition")}
    locations = {item["id"]: item for item in _load(raw, "sequence_location")}
    values = collections.defaultdict(dict)
    for item in _load(raw, "allele_location_value"):
        definition = definitions.get(item["alleledefinitionid"])
        location = locations.get(item["locationid"])
        if definition and location and location.get("dbsnpid"):
            values[(definition["genesymbol"], definition["name"])][location["dbsnpid"]] = item["variantallele"]
    by_rsid = {(item["genesymbol"], item["dbsnpid"]): item for item in locations.values() if item.get("dbsnpid")}
    alleles = {(item["genesymbol"], item["name"]): item for item in _load(raw, "allele")}

    genes: Dict[str, Any] = {}
    for gene, panel in ARRAY_PANEL.items():
        reference = next(item["name"] for item in definitions.values() if item["genesymbol"] == gene and item["matchesreferencesequence"])
        sites = []
        for rsid in panel["sites"]:
            location = by_rsid[(gene, rsid)]
            sites.append({
                "rsid": rsid,
                "grch38": location["chromosomelocation"],
                "gene_change": location["genelocation"],
                "protein": location["proteinlocation"],
                "reference_base": values[(gene, reference)][rsid],
            })
        allele_rows = {}
        for name in [reference, *panel["alleles"]]:
            function = alleles.get((gene, name), {})
            allele_rows[name] = {
                "function": function.get("clinicalfunctionalstatus"),
                "activity": function.get("activityvalue"),
                "at_sites": {rsid: values[(gene, name)].get(rsid, values[(gene, reference)][rsid]) for rsid in panel["sites"]},
            }
        genes[gene] = {"reference": reference, "sites": sites, "alleles": allele_rows}

    info_sites = {}
    for gene, rsid in WARFARIN_SITES.items():
        location = by_rsid[(gene, rsid)]
        info_sites[gene] = {"rsid": rsid, "grch38": location["chromosomelocation"], "gene_change": location["genelocation"]}

    function_table = collections.defaultdict(dict)
    for (gene, name), item in sorted(alleles.items()):
        if gene in CLINICAL_GENES:
            function_table[gene][name] = [item.get("clinicalfunctionalstatus"), item.get("activityvalue")]

    results = {item["id"]: item for item in _load(raw, "gene_result")}
    lookup = collections.defaultdict(list)
    for item in _load(raw, "gene_result_lookup"):
        result = results[item["phenotypeid"]]
        if result["genesymbol"] in LOOKUP_GENES:
            lookup[result["genesymbol"]].append({
                "key": item["lookupkey"],
                "phenotype": result["result"],
                "activity_score": result["activityscore"],
            })

    guidelines = {item["id"]: item for item in _load(raw, "guideline")}
    drug_names = {item["drugid"]: item for item in _load(raw, "drug")}
    drugs: Dict[str, Any] = {}
    for item in _load(raw, "recommendation"):
        name = drug_names[item["drugid"]]["name"]
        if name not in DRUGS or item["guidelineid"] not in GUIDELINE_IDS:
            continue
        population = _population(item.get("population"))
        if population in SKIP_POPULATIONS:
            continue
        guideline = guidelines[item["guidelineid"]]
        entry = drugs.setdefault(name, {
            "guideline": guideline["name"],
            "guideline_url": guideline["url"],
            "guideline_doi": GUIDELINE_DOI[item["guidelineid"]],
            "genes": sorted(item["lookupkey"]),
            "rows": [],
        })
        entry["rows"].append({
            "id": item["id"],
            "version": item["version"],
            "population": population,
            "lookup": item["lookupkey"],
            "classification": item["classification"],
            "recommendation": " ".join((item["drugrecommendation"] or "").split()),
            "category": category_for(item["drugrecommendation"] or ""),
        })
    warfarin = next(item for item in guidelines.values() if item["id"] == 100425)
    drugs["warfarin"] = {
        "guideline": warfarin["name"],
        "guideline_url": warfarin["url"],
        "guideline_doi": GUIDELINE_DOI[100425],
        "genes": ["CYP2C9", "VKORC1", "CYP4F2"],
        "rows": [],
        "flowchart": True,
    }
    for entry in drugs.values():
        entry["rows"].sort(key=lambda row: (row["population"], json.dumps(row["lookup"], sort_keys=True), row["id"]))
    change_log = _load(raw, "change_log")
    return {
        "schema": "cpic-snapshot/1",
        "source": {
            "api": API,
            "accessed": accessed,
            "latest_change_log": change_log[0]["date"] if change_log else None,
            "cpic_data_release": "v1.60.1",
            "license": "CC0-1.0 (CPIC curated content; see LICENSE-CPIC.md)",
            "attribution": "CPIC®, https://cpicpgx.org and https://www.clinpgx.org. CPIC content is updated over time; check the current guideline before clinical use.",
        },
        "genes": genes,
        "warfarin_sites": info_sites,
        "allele_function": {gene: function_table[gene] for gene in CLINICAL_GENES},
        "phenotype_lookup": {gene: lookup[gene] for gene in LOOKUP_GENES},
        "drugs": dict(sorted(drugs.items())),
    }


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw", type=Path, required=True)
    parser.add_argument("--fetch", action="store_true")
    parser.add_argument("--accessed", default=time.strftime("%Y-%m-%d"))
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args(argv)
    if args.fetch:
        fetch(args.raw)
    data = build(args.raw, args.accessed)
    args.out.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=False) + "\n", encoding="utf-8")
    counts = {name: len(entry["rows"]) for name, entry in data["drugs"].items()}
    print(f"wrote {args.out} ({len(counts)} drugs, {sum(counts.values())} rows)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
