"""Steerability alignment (SA) score.

SA is the Welch contrast of methylation deltas for compound-target genes
versus other genes in the same PPI module. Rank by |SA|. The sign is the
direction of the contrast, not evidence that a compound reverses methylation.
The statistic is a ranking feature. It is not a p-value and is not FDR-corrected.
"""

from __future__ import annotations

import numpy as np


def welch_t(a: np.ndarray, b: np.ndarray) -> float:
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    a = a[np.isfinite(a)]
    b = b[np.isfinite(b)]
    if len(a) < 2 or len(b) < 2:
        return 0.0
    n1, n2 = len(a), len(b)
    se = np.sqrt(a.var(ddof=1) / n1 + b.var(ddof=1) / n2)
    if se <= 1e-15:
        return 0.0
    return float((a.mean() - b.mean()) / se)


def compute_sa_score(
    delta: np.ndarray,
    target_idx: list[int],
    non_target_idx: list[int],
    min_intersection: int = 3,
    min_non_target: int = 3,
) -> float:
    if len(target_idx) < min_intersection or len(non_target_idx) < min_non_target:
        return 0.0
    return welch_t(np.asarray(delta, dtype=float)[target_idx], np.asarray(delta, dtype=float)[non_target_idx])


def compute_sa_matrix(
    delta_matrix: np.ndarray,
    pairs: list[dict],
    min_intersection: int = 3,
    min_non_target: int = 3,
) -> np.ndarray:
    """SA for every sample by every compound-module pair.

    ``delta_matrix`` is (n_samples, n_genes) and must be finite.
    """
    delta_matrix = np.asarray(delta_matrix, dtype=float)
    if not np.isfinite(delta_matrix).all():
        raise ValueError("delta_matrix contains NaN or infinite values; drop those genes before scoring")
    n_samples = delta_matrix.shape[0]
    sa = np.zeros((n_samples, len(pairs)), dtype=float)
    for pi, pair in enumerate(pairs):
        target_idx = pair["target_idx"]
        non_idx = pair["non_target_idx"]
        if len(target_idx) < min_intersection or len(non_idx) < min_non_target:
            continue
        target = delta_matrix[:, target_idx]
        non_target = delta_matrix[:, non_idx]
        n1, n2 = len(target_idx), len(non_idx)
        se = np.sqrt(target.var(axis=1, ddof=1) / n1 + non_target.var(axis=1, ddof=1) / n2)
        diff = target.mean(axis=1) - non_target.mean(axis=1)
        np.divide(diff, se, out=sa[:, pi], where=se > 1e-15)
    return sa
