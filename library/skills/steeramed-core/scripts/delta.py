"""N-of-1 methylation delta vectors.

Matched mode (RA, breast cancer, depression):
    delta = patient beta - mean beta of same-sex controls within the age caliper.
    When at least ``min_controls`` and fewer than K controls fall inside the
    caliper, all of those controls are used. Fewer than ``min_controls``
    inside the caliper yields no delta under the manuscript rule.

    ``fallback='repo'`` reproduces DeepoMe/SteeraMed ``match_controls``:
    drop the caliper and take the nearest same-sex controls.

Aging mode (GSE40279):
    delta = older adult (age > 55) - mean of young adults (age < 50).
    Ages 50 through 55 are excluded. Sex is not used.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class DeltaResult:
    sample_ids: list[str]
    deltas: np.ndarray
    notes: list[str] = field(default_factory=list)
    unmatched_ids: list[str] = field(default_factory=list)


def match_controls(
    case_age: float,
    case_sex: str,
    control_ages: np.ndarray,
    control_sexes: np.ndarray,
    k: int = 10,
    caliper: float = 5,
    min_controls: int = 3,
    fallback: str = "paper",
) -> tuple[np.ndarray, str]:
    """Return control indices and the rule that produced them.

    The rule is ``caliper``, ``repo_no_caliper``, or ``none``.
    """
    if fallback not in {"paper", "repo"}:
        raise ValueError("fallback must be 'paper' or 'repo'")
    control_ages = np.asarray(control_ages, dtype=float)
    control_sexes = np.asarray(control_sexes)
    sex_ok = control_sexes == case_sex
    age_diff = np.abs(control_ages - float(case_age))
    within = np.flatnonzero(sex_ok & (age_diff <= caliper))
    within = within[np.argsort(age_diff[within], kind="mergesort")]
    if len(within) >= min_controls:
        return within[:k], "caliper"
    if fallback == "repo":
        sex_idx = np.flatnonzero(sex_ok)
        if len(sex_idx) >= min_controls:
            sex_idx = sex_idx[np.argsort(age_diff[sex_idx], kind="mergesort")]
            return sex_idx[:k], "repo_no_caliper"
    return np.array([], dtype=int), "none"


def compute_n1_delta(patient: np.ndarray, controls: np.ndarray) -> np.ndarray:
    """Patient beta minus the gene-wise nanmean of matched controls."""
    ctrl_mean = np.nanmean(np.asarray(controls, dtype=float), axis=0)
    return np.asarray(patient, dtype=float) - ctrl_mean


def compute_matched_deltas(
    sample_ids: list[str],
    beta: np.ndarray,
    ages: np.ndarray,
    sexes: np.ndarray,
    groups: np.ndarray,
    k: int = 10,
    caliper: float = 5,
    min_controls: int = 3,
    fallback: str = "paper",
) -> DeltaResult:
    beta = np.asarray(beta, dtype=float)
    ages = np.asarray(ages, dtype=float)
    sexes = np.asarray(sexes).astype(str)
    groups = np.asarray(groups).astype(str)
    case_idx = np.flatnonzero(groups == "case")
    ctrl_idx = np.flatnonzero(groups == "control")
    if len(case_idx) == 0 or len(ctrl_idx) == 0:
        raise ValueError("Matched delta requires at least one case and one control")

    rows = []
    kept = []
    unmatched = []
    rules = {"caliper": 0, "repo_no_caliper": 0, "none": 0}
    for ci in case_idx:
        matched, rule = match_controls(
            float(ages[ci]),
            str(sexes[ci]),
            ages[ctrl_idx],
            sexes[ctrl_idx],
            k=k,
            caliper=caliper,
            min_controls=min_controls,
            fallback=fallback,
        )
        rules[rule] += 1
        if len(matched) == 0:
            unmatched.append(sample_ids[ci])
            continue
        rows.append(compute_n1_delta(beta[ci], beta[ctrl_idx[matched]]))
        kept.append(sample_ids[ci])

    notes = [
        f"match_fallback={fallback}",
        f"caliper_matches={rules['caliper']}",
        f"repo_no_caliper_matches={rules['repo_no_caliper']}",
        f"unmatched={rules['none']}",
    ]
    if not rows:
        return DeltaResult([], np.zeros((0, beta.shape[1])), notes, unmatched)
    return DeltaResult(kept, np.vstack(rows), notes, unmatched)


def compute_aging_deltas(
    sample_ids: list[str],
    beta: np.ndarray,
    ages: np.ndarray,
    young_max_exclusive: float = 50,
    old_min_exclusive: float = 55,
) -> DeltaResult:
    """Older-adult beta minus the mean beta of young adults."""
    beta = np.asarray(beta, dtype=float)
    ages = np.asarray(ages, dtype=float)
    young = np.flatnonzero(np.isfinite(ages) & (ages < young_max_exclusive))
    old = np.flatnonzero(np.isfinite(ages) & (ages > old_min_exclusive))
    if len(young) == 0 or len(old) == 0:
        raise ValueError(
            "Aging delta needs at least one sample with age < "
            f"{young_max_exclusive} and one with age > {old_min_exclusive}"
        )
    reference = np.nanmean(beta[young], axis=0)
    deltas = beta[old] - reference
    notes = [
        "delta_mode=aging_young_mean",
        f"n_young={len(young)}",
        f"n_old={len(old)}",
        f"excluded_gap_ages=[{young_max_exclusive}, {old_min_exclusive}]",
    ]
    return DeltaResult([sample_ids[i] for i in old], deltas, notes)
