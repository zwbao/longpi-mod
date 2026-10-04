"""Manuscript reference files and GEO phenotype rules.

Promoter probes are CpGs whose GENCODE distance to a TSS is from -1500 to 0
bases. That is the operational reading of the manuscript's TSS1500 + TSS200
window (0 to 1500 bp upstream).
"""

from __future__ import annotations

import gzip
import re
from collections import defaultdict
from pathlib import Path

import numpy as np

GEO = {
    "ra": "GSE42861",
    "breast_cancer": "GSE51032",
    "depression": "GSE128235",
    "aging": "GSE40279",
}

URLS = {
    "promoter_manifest": (
        "https://raw.githubusercontent.com/zhou-lab/InfiniumAnnotationData/"
        "main/Anno/HM450/HM450.hg19.manifest.gencode.v26lift37.tsv.gz"
    ),
    "epic_manifest": (
        "https://raw.githubusercontent.com/zhou-lab/InfiniumAnnotationData/"
        "main/Anno/EPIC/EPIC.hg19.manifest.gencode.v26lift37.tsv.gz"
    ),
    "epicv2_manifest": (
        "https://raw.githubusercontent.com/zhou-lab/InfiniumAnnotationData/"
        "main/Anno/EPICv2/EPICv2.hg19.manifest.gencode.v26lift37.tsv.gz"
    ),
    "string_links": "https://stringdb-downloads.org/download/protein.links.v12.0/9606.protein.links.v12.0.txt.gz",
    "string_info": "https://stringdb-downloads.org/download/protein.info.v12.0/9606.protein.info.v12.0.txt.gz",
    "stitch_links": "https://stitch-db.org/download/protein_chemical.links.v5.0/9606.protein_chemical.links.v5.0.tsv.gz",
    "stitch_sources": "https://stitch-db.org/download/chemical.sources.v5.0.tsv.gz",
}

ICD_CODE = re.compile(r"cancer type \(icd-10\):\s*([A-Z][0-9]+)", re.IGNORECASE)


def geo_matrix_url(gse: str) -> str:
    prefix = gse[:-3]
    return f"https://ftp.ncbi.nlm.nih.gov/geo/series/{prefix}nnn/{gse}/matrix/{gse}_series_matrix.txt.gz"


def promoter_genes_from_row(gene_names: str, distances: str) -> set[str]:
    """Gene symbols with at least one transcript in the upstream 1500 bp window."""
    names = [item.strip() for item in gene_names.split(";")]
    dists = [item.strip() for item in distances.split(";")]
    genes = set()
    for name, dist in zip(names, dists):
        if not name or name in {"NA", "."}:
            continue
        try:
            value = float(dist)
        except ValueError:
            continue
        if -1500 <= value <= 0:
            genes.add(name.split(".")[0])
    return genes


def load_promoter_map(path: Path) -> dict[str, set[str]]:
    mapping: dict[str, set[str]] = {}
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        header = handle.readline().rstrip("\n").split("\t")
        columns = {name: index for index, name in enumerate(header)}
        for required in ("probeID", "geneNames", "distToTSS"):
            if required not in columns:
                raise ValueError(f"{path} is missing column {required}")
        probe_i = columns["probeID"]
        name_i = columns["geneNames"]
        dist_i = columns["distToTSS"]
        for line in handle:
            parts = line.rstrip("\n").split("\t")
            if len(parts) <= dist_i:
                continue
            genes = promoter_genes_from_row(parts[name_i], parts[dist_i])
            if genes:
                mapping[parts[probe_i]] = genes
    return mapping


def _characteristic_rows(header_lines: list[str]) -> list[list[str]]:
    rows = []
    for line in header_lines:
        if not line.startswith("!Sample_characteristics_ch1"):
            continue
        rows.append([item.strip().strip('"') for item in line.rstrip("\n").split("\t")[1:]])
    return rows


def _field_map(rows: list[list[str]], sample_index: int, prefixes: tuple[str, ...]) -> str:
    for row in rows:
        if sample_index >= len(row):
            continue
        text = row[sample_index]
        key = text.split(":", 1)[0].strip().lower()
        if any(key.startswith(prefix) for prefix in prefixes):
            return text.split(":", 1)[-1].strip()
    return ""


def assign_groups(preset: str, rows: list[list[str]], n_samples: int) -> list[str]:
    """Return case, control, or exclude for each sample."""
    groups = []
    for index in range(n_samples):
        if preset == "aging":
            groups.append("cohort")
            continue
        if preset == "ra":
            disease = _field_map(rows, index, ("disease state",)).lower()
            if "rheumatoid" in disease:
                groups.append("case")
            elif disease == "normal":
                groups.append("control")
            else:
                groups.append("exclude")
            continue
        if preset == "depression":
            diagnosis = _field_map(rows, index, ("diagnosis",)).lower()
            if diagnosis == "case":
                groups.append("case")
            elif diagnosis == "control":
                groups.append("control")
            else:
                groups.append("exclude")
            continue
        if preset == "breast_cancer":
            codes = set()
            for row in rows:
                if index >= len(row):
                    continue
                match = ICD_CODE.search(row[index])
                if match:
                    codes.add(match.group(1).upper())
            if any(code.startswith("C50") for code in codes):
                groups.append("case")
            elif codes:
                groups.append("exclude")
            else:
                groups.append("control")
            continue
        raise KeyError(preset)
    return groups


def parse_sample_meta(header_lines: list[str], preset: str) -> list[dict]:
    accessions = []
    for line in header_lines:
        if line.startswith("!Sample_geo_accession"):
            accessions = [item.strip().strip('"') for item in line.rstrip("\n").split("\t")[1:]]
            break
    if not accessions:
        raise ValueError("series matrix is missing !Sample_geo_accession")
    rows = _characteristic_rows(header_lines)
    groups = assign_groups(preset, rows, len(accessions))
    samples = []
    for index, accession in enumerate(accessions):
        age_text = ""
        sex_text = ""
        for row in rows:
            if index >= len(row):
                continue
            text = row[index]
            key, _, value = text.partition(":")
            key = key.strip().lower()
            value = value.strip()
            if key in {"age", "age (y)"}:
                age_text = value
            elif key in {"gender", "sex"}:
                sex_text = value
        sex = sex_text[:1].upper()
        if sex not in {"M", "F"}:
            sex = ""
        try:
            age = float(age_text)
        except ValueError:
            age = float("nan")
        samples.append(
            {
                "sample_id": accession,
                "age": age,
                "sex": sex,
                "group": groups[index],
            }
        )
    return samples


def aggregate_promoter_beta(
    matrix_path: Path,
    probe_to_genes: dict[str, set[str]],
    preset: str,
) -> tuple[list[dict], list[str], np.ndarray]:
    """Stream a GEO series matrix into sample metadata and gene-level promoter betas.

    The returned matrix is samples by genes. A gene beta is the mean of its
    promoter CpGs. Probes outside the promoter map are ignored.
    """
    gene_sets: dict[str, None] = {}
    for genes in probe_to_genes.values():
        for gene in genes:
            gene_sets.setdefault(gene, None)
    genes = list(gene_sets)
    gene_index = {gene: index for index, gene in enumerate(genes)}
    header: list[str] = []
    sample_meta: list[dict] | None = None
    sums = None
    counts = None
    seen = 0
    with gzip.open(matrix_path, "rt", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            if line.startswith("!"):
                if line.startswith("!series_matrix_table_begin"):
                    sample_meta = parse_sample_meta(header, preset)
                    n_samples = len(sample_meta)
                    sums = np.zeros((n_samples, len(genes)), dtype=np.float64)
                    counts = np.zeros((n_samples, len(genes)), dtype=np.int32)
                else:
                    header.append(line)
                continue
            if line.startswith("!series_matrix_table_end") or line.startswith('"!series_matrix_table_end"'):
                break
            if sums is None:
                continue
            if line.startswith("ID_REF") or line.startswith('"ID_REF"'):
                continue
            probe, _, rest = line.rstrip("\n").partition("\t")
            probe = probe.strip().strip('"')
            mapped = probe_to_genes.get(probe)
            if not mapped:
                continue
            values = _parse_betas(rest)
            if len(values) != sums.shape[0]:
                raise ValueError(
                    f"{probe} has {len(values)} betas for {sums.shape[0]} samples"
                )
            finite = np.isfinite(values)
            for gene in mapped:
                column = gene_index[gene]
                sums[finite, column] += values[finite]
                counts[finite, column] += 1
            seen += 1
            if seen % 50000 == 0:
                print(f"promoter probes aggregated: {seen}", flush=True)
    if sample_meta is None or sums is None or counts is None:
        raise ValueError(f"{matrix_path} has no series matrix table")
    with np.errstate(invalid="ignore", divide="ignore"):
        beta = sums / counts
    beta[counts == 0] = np.nan
    return sample_meta, genes, beta.astype(np.float32)


def _parse_betas(rest: str) -> np.ndarray:
    cells = rest.split("\t")
    values = np.empty(len(cells), dtype=np.float64)
    for index, cell in enumerate(cells):
        text = cell.strip().strip('"')
        if text == "" or text.lower() in {"na", "nan", "null"}:
            values[index] = np.nan
        else:
            values[index] = float(text)
    return values


def load_string_symbols(path: Path) -> dict[str, str]:
    symbols = {}
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            if not line.strip() or line.startswith("#"):
                continue
            parts = line.rstrip("\n").split("\t")
            if parts[0] in {"protein_external_id", "#string_protein_id"} or parts[0].startswith("#"):
                continue
            if len(parts) < 2:
                continue
            symbols[parts[0]] = parts[1]
    return symbols


def iter_string_edges(path: Path, min_score: int):
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            parts = line.split()
            if len(parts) < 3:
                continue
            try:
                score = int(float(parts[2]))
            except ValueError:
                continue
            if score < min_score:
                continue
            yield parts[0], parts[1]


def _source_rows(path: Path):
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            if not line.strip() or line.startswith("#") or line.startswith("chemical\t"):
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 3:
                yield parts[0], parts[1].strip(), parts[2].strip()


def load_atc_chemicals(path: Path) -> set[str]:
    """Chemical IDs that STITCH marks with source ATC."""
    chemicals = {chemical for chemical, _alias, source in _source_rows(path) if source == "ATC"}
    if not chemicals:
        raise ValueError(f"No ATC chemicals found in {path}")
    return chemicals


def load_chemical_catalog(path: Path) -> dict[str, dict]:
    """ATC chemicals with a readable name and aliases from every STITCH source.

    The file is read twice: first to collect ATC identifiers, then to keep
    aliases for those identifiers only.
    """
    allowed = load_atc_chemicals(path)
    aliases: dict[str, list[str]] = {chemical: [] for chemical in allowed}
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            if not line.strip() or line.startswith("#") or line.startswith("chemical\t"):
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 2 or parts[0] not in aliases:
                continue
            alias = parts[1].strip()
            if alias and alias not in aliases[parts[0]]:
                aliases[parts[0]].append(alias)
    catalog = {}
    for chemical, names in aliases.items():
        catalog[chemical] = {
            "name": choose_display_name(names, chemical),
            "aliases": [name for name in names if name_like(name)][:25],
        }
    return catalog


def name_like(alias: str) -> bool:
    text = alias.strip()
    if len(text) < 3 or len(text) > 80:
        return False
    if re.fullmatch(r"[A-Z]\d{2}[A-Z]{2}\d{2}", text):
        return False
    if re.fullmatch(r"(CID[ms]?|CHEBI:|DB)\d+", text, re.IGNORECASE):
        return False
    return sum(character.isalpha() for character in text) >= 3


def choose_display_name(aliases: list[str], chemical_id: str) -> str:
    candidates = [alias for alias in aliases if name_like(alias)]
    if not candidates:
        return chemical_id
    candidates.sort(key=lambda text: (text.isupper(), " " not in text and not any(ch.islower() for ch in text), len(text), text.casefold()))
    return candidates[0]


def load_stitch_targets(
    path: Path,
    symbols: dict[str, str],
    allowed: set[str] | None,
    min_score: int,
    catalog: dict[str, dict] | None = None,
) -> list[dict]:
    """One record per chemical: protein-target count and mapped gene symbols."""
    genes_by_chem: dict[str, set[str]] = defaultdict(set)
    protein_counts: dict[str, int] = defaultdict(int)
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            if not line.strip() or line.startswith("chemical"):
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3:
                continue
            chemical, protein, score_text = parts[0], parts[1], parts[2]
            if allowed is not None and chemical not in allowed:
                continue
            try:
                score = int(float(score_text))
            except ValueError:
                continue
            if score < min_score:
                continue
            protein_counts[chemical] += 1
            symbol = symbols.get(protein)
            if symbol:
                genes_by_chem[chemical].add(symbol)
    compounds = []
    for chemical, count in protein_counts.items():
        record = (catalog or {}).get(chemical, {})
        compounds.append(
            {
                "id": chemical,
                "name": record.get("name", chemical),
                "aliases": list(record.get("aliases") or []),
                "targets": sorted(genes_by_chem.get(chemical, ())),
                "n_targets": count,
                "is_positive": False,
            }
        )
    compounds.sort(key=lambda item: item["id"])
    return compounds
