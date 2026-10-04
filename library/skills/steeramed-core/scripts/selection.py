"""Group-level module and feature selection, then per-patient importance.

Module selection and the top-200 feature cut use every case. They are not
leave-one-patient-out. Patient importance is the number of times a compound
appears among that patient's top-50 selected features, ordered by |SA|.
"""

from __future__ import annotations

import numpy as np
from scipy import stats


def one_sample_t(values: np.ndarray) -> tuple[float, float]:
    """Mean and two-sided one-sample t-test p-value against 0.

    A zero-variance nonzero vector has p = 0. A zero vector has p = 1.
    The p-value ranks modules or marks a nominal patient-level list.
    """
    vals = np.asarray(values, dtype=float)
    vals = vals[np.isfinite(vals)]
    if len(vals) < 2:
        return float("nan"), 1.0
    mean = float(vals.mean())
    if np.allclose(vals, vals[0]):
        return mean, (1.0 if abs(mean) < 1e-15 else 0.0)
    result = stats.ttest_1samp(vals, popmean=0.0)
    p_value = float(result.pvalue)
    if not np.isfinite(p_value):
        p_value = 1.0
    return mean, p_value


def select_modules(
    mean_gene_delta: np.ndarray,
    modules: list[dict],
    gene_to_idx: dict[str, int],
    top_n: int = 100,
) -> list[dict]:
    """Keep the ``top_n`` modules with the smallest one-sample p-values.

    ``mean_gene_delta`` is the across-patient mean delta, one value per gene,
    in the same order as ``gene_to_idx``.
    """
    ranked = []
    for module in modules:
        indices = [gene_to_idx[gene] for gene in module["genes"] if gene in gene_to_idx]
        mean, p_value = one_sample_t(np.asarray(mean_gene_delta)[indices] if indices else [])
        if len(indices) < 2 or not np.isfinite(mean):
            continue
        ranked.append(
            {
                "hub": module["hub"],
                "genes": [gene for gene in module["genes"] if gene in gene_to_idx],
                "gene_indices": indices,
                "hallmark": module.get("hallmark"),
                "mean_delta": mean,
                "p_value": p_value,
                "n_genes": len(indices),
            }
        )
    ranked.sort(key=lambda row: (row["p_value"], -abs(row["mean_delta"]), row["hub"]))
    return ranked[:top_n]


def target_count(compound: dict) -> int:
    if "n_targets" in compound and compound["n_targets"] is not None:
        return int(compound["n_targets"])
    return len(compound.get("targets") or [])


def filter_compounds(
    compounds: list[dict],
    min_targets: int,
    max_targets: int | None,
) -> list[dict]:
    """Apply the phenotype target-count window. Positives are not exempt."""
    kept = []
    for compound in compounds:
        count = target_count(compound)
        if count < min_targets:
            continue
        if max_targets is not None and count > max_targets:
            continue
        kept.append(compound)
    return kept


def build_pairs(
    modules: list[dict],
    compounds: list[dict],
    gene_to_idx: dict[str, int],
    min_intersection: int = 3,
    min_non_target: int = 3,
) -> list[dict]:
    pairs = []
    for module in modules:
        module_genes = [gene for gene in module["genes"] if gene in gene_to_idx]
        module_set = set(module_genes)
        for compound in compounds:
            targets = []
            seen = set()
            for gene in compound.get("targets") or []:
                if gene in module_set and gene not in seen:
                    targets.append(gene)
                    seen.add(gene)
            if len(targets) < min_intersection:
                continue
            non_targets = [gene for gene in module_genes if gene not in seen]
            if len(non_targets) < min_non_target:
                continue
            pairs.append(
                {
                    "module_hub": module["hub"],
                    "hallmark": module.get("hallmark"),
                    "compound_id": str(compound["id"]),
                    "compound_name": compound.get("name") or str(compound["id"]),
                    "is_positive": bool(compound.get("is_positive", False)),
                    "is_known_drug": bool(compound.get("is_known_drug", compound.get("is_positive", False))),
                    "n_targets": target_count(compound),
                    "aliases": list(compound.get("aliases") or []),
                    "target_genes": targets,
                    "target_idx": [gene_to_idx[gene] for gene in targets],
                    "non_target_idx": [gene_to_idx[gene] for gene in non_targets],
                }
            )
    return pairs


def select_features(sa_matrix: np.ndarray, top_n: int = 200) -> tuple[np.ndarray, np.ndarray]:
    """Column indices of the top features by mean |SA| across patients."""
    mean_abs = np.mean(np.abs(sa_matrix), axis=0)
    order = np.argsort(-mean_abs, kind="mergesort")
    keep = order[: min(top_n, len(order))]
    return keep, mean_abs


def rank_patient(sa_row: np.ndarray, pairs: list[dict], top_k: int = 50) -> list[dict]:
    """Rank compounds by how often they occur in this patient's top-k features.

    Ties break by higher mean |SA|, then by compound id. This function scores
    one patient. It does not add votes across patients.
    """
    if len(pairs) != len(sa_row):
        raise ValueError("sa_row and pairs must have the same length")
    if len(sa_row) == 0:
        return []
    order = np.argsort(-np.abs(sa_row), kind="mergesort")[: min(top_k, len(sa_row))]
    votes: dict[str, int] = {}
    sa_values: dict[str, list[float]] = {}
    info: dict[str, dict] = {}
    details: dict[str, list[dict]] = {}
    for index in order:
        pair = pairs[int(index)]
        cid = pair["compound_id"]
        signed = float(sa_row[int(index)])
        votes[cid] = votes.get(cid, 0) + 1
        sa_values.setdefault(cid, []).append(signed)
        info.setdefault(cid, pair)
        details.setdefault(cid, []).append(
            {
                "ppi_hub": pair["module_hub"],
                "sa": signed,
                "abs_sa": abs(signed),
                "target_genes": list(pair["target_genes"]),
                "hallmark": pair.get("hallmark"),
            }
        )

    ordered_ids = sorted(
        votes,
        key=lambda cid: (-votes[cid], -float(np.mean(np.abs(sa_values[cid]))), cid),
    )
    ranked = []
    for rank, cid in enumerate(ordered_ids, start=1):
        pair = info[cid]
        ranked.append(
            {
                "rank": rank,
                "compound_id": cid,
                "compound_name": pair["compound_name"],
                "aliases": list(pair.get("aliases") or []),
                "importance": votes[cid],
                "mean_abs_sa": float(np.mean(np.abs(sa_values[cid]))),
                "is_known_drug": pair["is_known_drug"],
                "is_positive": pair["is_positive"],
                "n_targets": pair["n_targets"],
                "matched_modules": details[cid],
            }
        )
    return ranked
