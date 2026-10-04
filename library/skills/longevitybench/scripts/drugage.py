"""DrugAge ranking as implemented in longevityclaw/drugage.py.

The composite score is that file's formula. Ties break by compound name so a
set-iteration order cannot change the report.
"""

from __future__ import annotations

import csv
import hashlib
from dataclasses import dataclass, field
from pathlib import Path

from presets import (
    BASE_NEGATIVE_DIVISOR,
    BASE_POSITIVE_DIVISOR,
    CONSISTENCY_WEIGHT,
    DRUGAGE_SHA256,
    ITP_BONUS,
    RANK_MIN_STUDIES,
    SCORE_CEILING,
    SCORE_FLOOR,
    SPECIES_BONUS_CAP,
    SPECIES_BONUS_PER,
    TOP_STUDIES_KEPT,
)


@dataclass
class DrugStudy:
    compound: str
    species: str
    strain: str
    dosage: str
    avg_lifespan_change: float | None
    max_lifespan_change: float | None
    avg_significance: str
    max_significance: str
    gender: str
    is_itp: bool
    pubmed_id: str


@dataclass
class CompoundScore:
    compound: str
    n_studies: int
    n_species: int
    species_list: list[str]
    mean_lifespan_change: float
    max_lifespan_change: float
    consistency: float
    itp_validated: bool
    longevity_score: float
    top_studies: list[DrugStudy] = field(default_factory=list)
    rank: int = 0


def _parse_float(val: str) -> float | None:
    if not val or val.strip() == "":
        return None
    try:
        return float(val)
    except ValueError:
        return None


def snapshot_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def load_drugage(path: Path) -> list[DrugStudy]:
    if snapshot_sha256(path) != DRUGAGE_SHA256:
        raise ValueError(f"DrugAge snapshot hash does not match the locked file: {path}")
    studies: list[DrugStudy] = []
    with path.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            study = DrugStudy(
                compound=row.get("compound_name", "").strip(),
                species=row.get("species", "").strip(),
                strain=row.get("strain", "").strip(),
                dosage=row.get("dosage", "").strip(),
                avg_lifespan_change=_parse_float(row.get("avg_lifespan_change_percent", "")),
                max_lifespan_change=_parse_float(row.get("max_lifespan_change_percent", "")),
                avg_significance=row.get("avg_lifespan_significance", "").strip(),
                max_significance=row.get("max_lifespan_significance", "").strip(),
                gender=row.get("gender", "").strip(),
                is_itp=row.get("ITP", "").strip().lower() == "yes",
                pubmed_id=row.get("pubmed_id", "").strip(),
            )
            if study.compound:
                studies.append(study)
    return studies


def _consistency(changes: list[float]) -> float:
    if not changes:
        return 0.0
    return sum(1 for change in changes if change > 0) / len(changes)


def score_compound(compound: str, studies: list[DrugStudy]) -> CompoundScore | None:
    matched = [study for study in studies if study.compound.lower() == compound.lower()]
    if not matched:
        return None
    avg_changes = [study.avg_lifespan_change for study in matched if study.avg_lifespan_change is not None]
    max_changes = [study.max_lifespan_change for study in matched if study.max_lifespan_change is not None]
    mean_avg = sum(avg_changes) / len(avg_changes) if avg_changes else 0.0
    best_max = max(max_changes) if max_changes else 0.0
    species = {study.species for study in matched}
    itp_validated = any(study.is_itp for study in matched)
    consistency = _consistency(avg_changes)
    if mean_avg > 0:
        base_score = min(mean_avg / BASE_POSITIVE_DIVISOR, SCORE_CEILING)
    else:
        base_score = max(mean_avg / BASE_NEGATIVE_DIVISOR, -SCORE_CEILING)
    species_bonus = min(len(species) * SPECIES_BONUS_PER, SPECIES_BONUS_CAP)
    itp_bonus = ITP_BONUS if itp_validated else 0.0
    consistency_bonus = consistency * CONSISTENCY_WEIGHT
    longevity_score = base_score + species_bonus + itp_bonus + consistency_bonus
    longevity_score = max(SCORE_FLOOR, min(SCORE_CEILING, longevity_score))
    sorted_studies = sorted(
        [study for study in matched if study.avg_lifespan_change is not None],
        key=lambda study: study.avg_lifespan_change or 0,
        reverse=True,
    )
    return CompoundScore(
        compound=matched[0].compound,
        n_studies=len(matched),
        n_species=len(species),
        species_list=sorted(species),
        mean_lifespan_change=round(mean_avg, 2),
        max_lifespan_change=round(best_max, 2),
        consistency=round(consistency, 3),
        itp_validated=itp_validated,
        longevity_score=round(longevity_score, 4),
        top_studies=sorted_studies[:TOP_STUDIES_KEPT],
    )


def rank_compounds(studies: list[DrugStudy], min_studies: int = RANK_MIN_STUDIES) -> list[CompoundScore]:
    names = sorted({study.compound for study in studies})
    scored = []
    for name in names:
        score = score_compound(name, studies)
        if score and score.n_studies >= min_studies:
            scored.append(score)
    scored.sort(key=lambda score: (-score.longevity_score, score.compound.lower()))
    for index, score in enumerate(scored, start=1):
        score.rank = index
    return scored


def count_compounds(studies: list[DrugStudy]) -> int:
    return len({study.compound for study in studies})


def count_itp_compounds(studies: list[DrugStudy]) -> int:
    return len({study.compound for study in studies if study.is_itp})
