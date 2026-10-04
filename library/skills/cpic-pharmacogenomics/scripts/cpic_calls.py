"""Genotype -> CPIC diplotype -> CPIC phenotype -> CPIC recommendation rows.

All tables come from ../data/cpic_tables.json. The array caller does not count
"alt alleles": for each gene it enumerates every pair of CPIC alleles whose
definitions at the tested positions reproduce the observed genotypes, maps
each pair through CPIC's phenotype lookup, and calls a phenotype only when all
pairs agree. So an unphased double heterozygote (TPMT rs1800460 + rs1142345:
*1/*3A or *3B/*3C) comes out as undetermined, with both candidates listed.
"""

from __future__ import annotations

import itertools
import json
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from genotype_file import GenotypeFile, called_alleles
from presets import ALLELE_LABELS

DATA = Path(__file__).resolve().parent.parent / "data" / "cpic_tables.json"
IUPAC = {
    "A": "A", "C": "C", "G": "G", "T": "T", "R": "AG", "Y": "CT", "S": "CG", "W": "AT",
    "K": "GT", "M": "AC", "B": "CGT", "D": "AGT", "H": "ACT", "V": "ACG", "N": "ACGT",
}
ACTIVITY_GENES = {"CYP2C9", "CYP2D6", "DPYD"}
HLA_GENES = {"HLA-A", "HLA-B"}
NO_RESULT = "No Result"


def load_tables(path: Path = DATA) -> Dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def bases(value: str) -> Set[str]:
    """Plus-strand bases a CPIC allele value allows at a position."""
    value = (value or "").strip().upper()
    if len(value) == 1 and value in IUPAC:
        return set(IUPAC[value])
    return {value}


@dataclass
class GeneCall:
    gene: str
    source: str  # array, clinical, not_tested, unreadable
    tested: List[Tuple[str, str]] = field(default_factory=list)
    missing: List[str] = field(default_factory=list)
    unusable: List[Tuple[str, str, str]] = field(default_factory=list)
    not_assessed: List[Tuple[str, List[str]]] = field(default_factory=list)
    diplotypes: List[str] = field(default_factory=list)
    phenotypes: List[str] = field(default_factory=list)
    lookup_values: List[str] = field(default_factory=list)
    activity_scores: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)

    @property
    def called(self) -> bool:
        return len(set(self.lookup_values)) == 1

    @property
    def phenotype(self) -> Optional[str]:
        return self.phenotypes[0] if len(set(self.phenotypes)) == 1 else None


# ---------------------------------------------------------------------------
# Phenotype lookup (CPIC gene_result_lookup)
# ---------------------------------------------------------------------------


def _allele_key(gene: str, function: Optional[str], activity: Optional[str]) -> Optional[str]:
    if gene in ACTIVITY_GENES:
        return activity if activity not in (None, "") else None
    return function


def phenotype_for(tables: Dict[str, Any], gene: str, pair: Tuple[Tuple[Optional[str], Optional[str]], ...]) -> Tuple[str, Optional[str]]:
    """(CPIC phenotype, total activity score or None) for two alleles' (function, activity)."""
    keys = [_allele_key(gene, function, activity) for function, activity in pair]
    if any(item is None for item in keys):
        return "Indeterminate", None
    wanted: Dict[str, int] = {}
    for item in keys:
        wanted[item] = wanted.get(item, 0) + 1
    for row in tables["phenotype_lookup"].get(gene, []):
        if row["key"] == wanted:
            score = row.get("activity_score")
            return row["phenotype"], (score if score not in (None, "n/a") else None)
    return "Indeterminate", None


def lookup_value(gene: str, phenotype: str, activity: Optional[str]) -> str:
    """The value CPIC recommendation rows use for this gene."""
    if gene in ACTIVITY_GENES:
        return activity if activity else "n/a"
    return phenotype


# ---------------------------------------------------------------------------
# Array caller
# ---------------------------------------------------------------------------


def call_from_array(tables: Dict[str, Any], gene: str, genotypes: GenotypeFile, reference_label: str) -> GeneCall:
    panel = tables["genes"][gene]
    reference = panel["reference"]
    alleles = panel["alleles"]
    out = GeneCall(gene=gene, source="array")
    usable: Dict[str, List[str]] = {}
    for site in panel["sites"]:
        rsid = site["rsid"]
        genotype = genotypes.genotype(rsid)
        if genotype is None:
            out.missing.append(rsid)
            continue
        if "D" in genotype or "I" in genotype:
            out.unusable.append((rsid, genotype, "插入缺失记法，这个位点只看单碱基"))
            continue
        known: Set[str] = set()
        for allele in alleles.values():
            known |= bases(allele["at_sites"][rsid])
        observed = called_alleles(genotype)
        if not set(observed) <= known:
            out.unusable.append((rsid, genotype, f"碱基不是这个位点在正链上的 {'/'.join(sorted(known))}，可能是链方向或文件格式不同"))
            continue
        usable[rsid] = sorted(observed)
        out.tested.append((rsid, genotype))
    if not usable:
        out.source = "not_tested" if not out.unusable else "unreadable"
        return out

    ref_values = alleles[reference]["at_sites"]
    universe = [reference]
    for name, allele in alleles.items():
        if name == reference:
            continue
        # Sites where this allele cannot carry the reference base. A site the
        # allele leaves open (IUPAC code covering the reference) does not
        # identify it.
        distinguishing = [rsid for rsid in allele["at_sites"] if not bases(ref_values[rsid]) <= bases(allele["at_sites"][rsid])]
        if any(rsid in usable for rsid in distinguishing):
            universe.append(name)
        else:
            out.not_assessed.append((name, distinguishing))

    def fits(first: str, second: str) -> bool:
        for rsid, observed in usable.items():
            a = bases(alleles[first]["at_sites"][rsid])
            b = bases(alleles[second]["at_sites"][rsid])
            if not any(sorted([x, y]) == observed for x in a for y in b):
                return False
        return True

    signature = {name: tuple(frozenset(bases(alleles[name]["at_sites"][rsid])) for rsid in sorted(usable)) for name in universe}
    groups: Dict[Tuple[Any, ...], List[str]] = {}
    for name in universe:
        groups.setdefault(signature[name], []).append(name)

    def label(name: str) -> str:
        members = groups[signature[name]]
        shown = [reference_label if member == reference else ALLELE_LABELS.get(member, member) for member in members]
        return shown[0] if len(shown) == 1 else "（" + " 或 ".join(shown) + "）"

    seen_diplotypes: List[str] = []
    results: List[Tuple[str, Optional[str]]] = []
    for first, second in itertools.combinations_with_replacement(universe, 2):
        if not fits(first, second):
            continue
        diplotype = "/".join(sorted([label(first), label(second)], key=lambda text: (text != reference_label, text)))
        if diplotype not in seen_diplotypes:
            seen_diplotypes.append(diplotype)
        pair = tuple((alleles[name]["function"], alleles[name]["activity"]) for name in (first, second))
        results.append(phenotype_for(tables, gene, pair))
    if not results:
        out.source = "unreadable"
        out.notes.append("观察到的基因型组合对不上 CPIC 里任何两个等位基因的组合。")
        return out
    out.diplotypes = seen_diplotypes
    for phenotype, score in results:
        value = lookup_value(gene, phenotype, score)
        if value not in out.lookup_values:
            out.lookup_values.append(value)
            out.phenotypes.append(phenotype)
            out.activity_scores.append(score or "")
    return out


# ---------------------------------------------------------------------------
# Clinical diplotypes (--diplotypes)
# ---------------------------------------------------------------------------

GENE_NAMES = ["CYP2C19", "CYP2C9", "CYP2D6", "TPMT", "NUDT15", "DPYD", "CYP3A5", "SLCO1B1", "HLA-B", "HLA-A"]
POSITIVE = ("positive", "阳性", "携带", "carrier", "+")
NEGATIVE = ("negative", "阴性", "未携带", "不携带", "non-carrier", "noncarrier", "-")


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).replace("＊", "*")
    return re.sub(r"\s+", " ", text).strip()


def allele_aliases(tables: Dict[str, Any], gene: str) -> Dict[str, str]:
    """Name as written on a report -> CPIC allele name."""
    table = tables["allele_function"].get(gene, {})
    aliases: Dict[str, str] = {}
    for name in table:
        aliases[name.casefold()] = name
        for inner in re.findall(r"\(([^)]+)\)", name):
            aliases.setdefault(inner.strip().casefold(), name)
    if gene == "DPYD":
        aliases.setdefault("*1", "Reference")
        aliases.setdefault("hapb3", "c.1129-5923C>G, c.1236G>A (HapB3)")
    return aliases


def parse_diplotype_lines(tables: Dict[str, Any], text: str) -> Tuple[Dict[str, GeneCall], List[str]]:
    """Calls from lines like 'CYP2C19 *1/*2' or 'HLA-B*58:01 阴性'. Returns (calls, problems_zh)."""
    calls: Dict[str, GeneCall] = {}
    problems: List[str] = []
    for raw in text.splitlines():
        line = _normalize(raw)
        if not line or line.startswith("#"):
            continue
        gene = next((name for name in sorted(GENE_NAMES, key=len, reverse=True) if line.upper().startswith(name)), None)
        if gene is None:
            problems.append(f"「{raw.strip()}」没有以基因名开头（例如 CYP2C19 *1/*2）。")
            continue
        rest = line[len(gene):].strip(" :：,，\t")
        if gene in HLA_GENES:
            call = _hla_call(gene, rest)
            if call is None:
                problems.append(f"「{raw.strip()}」看不出是哪个 HLA 等位基因、阳性还是阴性（例如 HLA-B*58:01 阴性）。")
                continue
            existing = calls.setdefault(gene, GeneCall(gene=gene, source="clinical"))
            existing.lookup_values.append(call)
            existing.phenotypes.append(call)
            existing.diplotypes.append(rest)
            continue
        parts = [item.strip() for item in re.split(r"\s*/\s*", rest) if item.strip()]
        if len(parts) != 2:
            problems.append(f"「{raw.strip()}」不是两个等位基因用 / 分开的写法（例如 CYP2D6 *1/*10）。")
            continue
        aliases = allele_aliases(tables, gene)
        names = [aliases.get(part.casefold()) for part in parts]
        call = GeneCall(gene=gene, source="clinical", diplotypes=["/".join(parts)])
        table = tables["allele_function"].get(gene, {})
        if any(name is None for name in names):
            unknown = [part for part, name in zip(parts, names) if name is None]
            call.notes.append("CPIC 等位基因表里没有 " + "、".join(unknown) + "，所以判定不了。")
            call.phenotypes = ["Indeterminate"]
            call.lookup_values = [lookup_value(gene, "Indeterminate", None)]
            call.activity_scores = [""]
        else:
            pair = tuple((table[name][0], table[name][1]) for name in names)
            phenotype, score = phenotype_for(tables, gene, pair)
            call.phenotypes = [phenotype]
            call.lookup_values = [lookup_value(gene, phenotype, score)]
            call.activity_scores = [score or ""]
        if gene in calls:
            problems.append(f"{gene} 写了两次，只保留第一次。")
            continue
        calls[gene] = call
    return calls, problems


def _hla_call(gene: str, rest: str) -> Optional[str]:
    # Chinese reports often drop the colon: HLA-B*5801.
    match = re.search(r"\*?\s*(\d{2}):?(\d{2})(?!\d)", rest)
    if not match:
        return None
    lowered = rest.casefold()
    tail = lowered[match.end():]
    if any(word in tail for word in ("阴性", "negative", "未携带", "不携带", "non")):
        sign = "negative"
    elif any(word in tail for word in ("阳性", "positive", "携带", "carrier", "+")):
        sign = "positive"
    else:
        return None
    return f"*{match.group(1)}:{match.group(2)} {sign}"


# ---------------------------------------------------------------------------
# Recommendation rows
# ---------------------------------------------------------------------------


@dataclass
class Branch:
    population: str
    rows: List[Dict[str, Any]]

    @property
    def categories(self) -> List[str]:
        return sorted({row["category"] for row in self.rows})


@dataclass
class DrugResult:
    drug: str
    status: str  # ok, needs_test, flowchart
    genes: List[str]
    branches: List[Branch] = field(default_factory=list)
    needs: List[str] = field(default_factory=list)
    no_result_genes: List[str] = field(default_factory=list)

    @property
    def categories(self) -> List[str]:
        found: Set[str] = set()
        for branch in self.branches:
            found |= set(branch.categories)
        return sorted(found)


def user_values(calls: Dict[str, GeneCall], gene: str, entry: Optional[Dict[str, Any]] = None) -> Set[str]:
    """Values this person has for a gene, as CPIC rows write them.

    HLA results are per allele: a drug keyed on HLA-B*15:02 treats a report
    that only gives HLA-B*58:01 as no result for that drug.
    """
    call = calls.get(gene)
    if call is None or not call.lookup_values:
        return {NO_RESULT}
    values = set(call.lookup_values)
    if gene in HLA_GENES and entry is not None:
        wanted = {row["lookup"][gene].split()[0] for row in entry["rows"] if gene in row["lookup"] and row["lookup"][gene] != NO_RESULT}
        values = {value for value in values if value.split()[0] in wanted}
        if not values:
            return {NO_RESULT}
    return values


def drug_result(tables: Dict[str, Any], drug: str, calls: Dict[str, GeneCall]) -> DrugResult:
    entry = tables["drugs"][drug]
    genes = list(entry["genes"])
    if entry.get("flowchart"):
        return DrugResult(drug=drug, status="flowchart", genes=genes)
    out = DrugResult(drug=drug, status="ok", genes=genes)
    by_population: Dict[str, List[Dict[str, Any]]] = {}
    for row in entry["rows"]:
        by_population.setdefault(row["population"], []).append(row)
    have = {gene: user_values(calls, gene, entry) for gene in genes}
    missing = [gene for gene in genes if NO_RESULT in have[gene]]
    for population, rows in by_population.items():
        matched = []
        for row in rows:
            if all(value in have.get(gene, {NO_RESULT}) for gene, value in row["lookup"].items()):
                matched.append(row)
        if matched:
            out.branches.append(Branch(population=population, rows=matched))
    if not out.branches or (missing and len(missing) == len(genes)):
        out.status = "needs_test"
        out.branches = []
        out.needs = missing or genes
        return out
    out.no_result_genes = missing
    return out


def all_drug_results(tables: Dict[str, Any], calls: Dict[str, GeneCall]) -> List[DrugResult]:
    return [drug_result(tables, drug, calls) for drug in tables["drugs"]]


def format_activity(value: float) -> str:
    """CPIC's way of writing an activity score: 1.0, 1.5, 0.25."""
    text = f"{value:.2f}"
    return text[:-1] if text.endswith("0") else text


def iter_rows(tables: Dict[str, Any]) -> Iterable[Tuple[str, Dict[str, Any]]]:
    for drug, entry in tables["drugs"].items():
        for row in entry["rows"]:
            yield drug, row
