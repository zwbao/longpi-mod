"""Retrospective known-action recovery.

Recall-K is the fraction of patients whose personal top-K contains at least
one positive-control compound. The random baseline is the manuscript's
binomial approximation, 1 - (1 - n_pos / n_candidates)^K.

``operational_group_fold`` is not that metric and is not Figure 2B. It is
(n_positives in a group top-K) / (K * n_pos / n_candidates).
"""

from __future__ import annotations

import numpy as np


def random_baseline(n_pos: int, n_candidates: int, k: int) -> float:
    if n_candidates <= 0 or k <= 0 or n_pos <= 0:
        return 0.0
    ratio = min(max(n_pos / n_candidates, 0.0), 1.0)
    return float(1.0 - (1.0 - ratio) ** k)


def recall_at_k(rankings: list[list[str]], positive_ids: set[str], k: int) -> dict:
    hits = 0
    for ranked in rankings:
        if positive_ids.intersection(ranked[:k]):
            hits += 1
    n_patients = len(rankings)
    recall = hits / n_patients if n_patients else 0.0
    return {"k": k, "hits": hits, "n_patients": n_patients, "recall": recall}


def recall_report(
    rankings: list[list[str]],
    positive_ids: set[str],
    n_candidates: int,
    ks: tuple[int, ...] = (5, 10, 20, 50),
) -> dict:
    n_pos = len(positive_ids)
    rows = []
    for k in ks:
        row = recall_at_k(rankings, positive_ids, k)
        baseline = random_baseline(n_pos, n_candidates, k)
        row["baseline"] = baseline
        row["fold"] = (row["recall"] / baseline) if baseline > 0 else None
        rows.append(row)
    return {
        "n_positive_controls": n_pos,
        "n_candidates": n_candidates,
        "by_k": rows,
    }


def enrichment_fold(n_hits: int, k: int, n_pos: int, n_candidates: int) -> float:
    if k <= 0 or n_candidates <= 0 or n_pos <= 0:
        return float("nan")
    expected = k * (n_pos / n_candidates)
    if expected <= 0:
        return float("nan")
    return float(n_hits / expected)


def compound_max_abs(sa_matrix: np.ndarray, pairs: list[dict], pool_ids: list[str]) -> tuple[list[str], np.ndarray]:
    """Per patient, the max |SA| of each pooled compound. Missing pairs score 0."""
    sa_matrix = np.asarray(sa_matrix, dtype=float)
    ids = list(pool_ids)
    index = {cid: i for i, cid in enumerate(ids)}
    scores = np.zeros((sa_matrix.shape[0], len(ids)), dtype=float)
    for column, pair in enumerate(pairs):
        cid = pair["compound_id"]
        if cid not in index:
            continue
        scores[:, index[cid]] = np.maximum(scores[:, index[cid]], np.abs(sa_matrix[:, column]))
    return ids, scores


def operational_group_bootstrap(
    sa_matrix: np.ndarray,
    pairs: list[dict],
    pool_ids: list[str],
    positive_ids: set[str],
    n_iter: int = 100,
    k: int = 10,
    seed: int = 0,
) -> dict:
    """Resample patients and rank compounds by mean max-|SA|.

    Label the result ``operational_group_fold``. Do not report it as the
    manuscript's Figure 2B bootstrap.
    """
    ids, max_abs = compound_max_abs(sa_matrix, pairs, pool_ids)
    is_positive = np.array([cid in positive_ids for cid in ids])
    n_patients = max_abs.shape[0]
    rng = np.random.default_rng(seed)
    folds = []
    for _ in range(n_iter):
        chosen = rng.choice(n_patients, size=n_patients, replace=True)
        scores = max_abs[chosen].mean(axis=0)
        top = np.argsort(-scores, kind="mergesort")[:k]
        hits = int(is_positive[top].sum())
        folds.append(enrichment_fold(hits, k, int(is_positive.sum()), len(ids)))
    arr = np.asarray(folds, dtype=float)
    finite = arr[np.isfinite(arr)]
    return {
        "metric": "operational_group_fold",
        "k": k,
        "n_iter": n_iter,
        "median": float(np.median(finite)) if len(finite) else None,
        "mean": float(np.mean(finite)) if len(finite) else None,
        "fraction_above_1": float(np.mean(finite > 1)) if len(finite) else None,
    }
