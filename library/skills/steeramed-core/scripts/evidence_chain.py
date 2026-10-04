"""Four-layer SteeraMed Core evidence chain for one patient."""

from __future__ import annotations

import numpy as np

from selection import one_sample_t, rank_patient

BOUNDARY = (
    "这是机制对齐假设，不是治疗建议。全血启动子甲基化是免疫细胞组成、活化状态和调控状态的复合信号。"
    "本结果不证明临床疗效，不构成用药依据，也不满足 FDA Plausible Mechanism Framework 的证据要求。"
)


def individual_bootstrap(
    sa_matrix: np.ndarray,
    pairs: list[dict],
    patient_index: int,
    n_iter: int = 200,
    top_features: int = 200,
    patient_top_k: int = 50,
    top_n: int = 10,
    seed: int = 0,
) -> dict[str, float]:
    """Percent of resamples in which each compound stays in this patient's top-n.

    Each resample redraws patients, re-selects the top features by mean |SA|,
    and re-ranks the fixed patient. The returned numbers are percentages on
    a 0-100 scale.
    """
    if n_iter <= 0:
        return {}
    sa_matrix = np.asarray(sa_matrix, dtype=float)
    n_patients, n_pairs = sa_matrix.shape
    rng = np.random.default_rng(seed)
    counts: dict[str, int] = {}
    feature_cap = min(top_features, n_pairs)
    for _ in range(n_iter):
        chosen = rng.choice(n_patients, size=n_patients, replace=True)
        mean_abs = np.mean(np.abs(sa_matrix[chosen]), axis=0)
        features = np.argsort(-mean_abs, kind="mergesort")[:feature_cap]
        sub_pairs = [pairs[int(i)] for i in features]
        ranking = rank_patient(sa_matrix[patient_index, features], sub_pairs, top_k=patient_top_k)
        for row in ranking[:top_n]:
            cid = row["compound_id"]
            counts[cid] = counts.get(cid, 0) + 1
    return {cid: 100.0 * count / n_iter for cid, count in counts.items()}


def build_evidence_chain(
    patient_id: str,
    delta_row: np.ndarray,
    selected_modules: list[dict],
    sa_row: np.ndarray,
    feature_pairs: list[dict],
    preset: str,
    age: int | None = None,
    sex: str | None = None,
    bootstrap_stability: dict[str, float] | None = None,
    nominal_p: float = 0.05,
    patient_top_k: int = 50,
    n_candidates: int = 0,
    meta: dict | None = None,
) -> dict:
    perturbed = []
    for module in selected_modules:
        mean, p_value = one_sample_t(np.asarray(delta_row)[module["gene_indices"]])
        if p_value >= nominal_p:
            continue
        perturbed.append(
            {
                "hub_gene": module["hub"],
                "delta": mean,
                "p_value": p_value,
                "n_genes": module["n_genes"],
                "hallmark": module.get("hallmark"),
            }
        )
    perturbed.sort(key=lambda row: (row["p_value"], row["hub_gene"]))

    ranking = rank_patient(sa_row, feature_pairs, top_k=patient_top_k)
    mechanism = {}
    for compound in ranking[:10]:
        hubs = []
        genes = []
        hallmarks = []
        for match in compound["matched_modules"]:
            if match["ppi_hub"] not in hubs:
                hubs.append(match["ppi_hub"])
            for gene in match["target_genes"]:
                if gene not in genes:
                    genes.append(gene)
            hallmark = match.get("hallmark")
            if hallmark and hallmark not in hallmarks:
                hallmarks.append(hallmark)
        mechanism[compound["compound_id"]] = {
            "ppi_hubs": hubs,
            "target_genes": genes,
            "hallmarks": hallmarks,
        }

    known_in_top10 = sum(1 for row in ranking[:10] if row["is_positive"])
    chain_meta = {
        "preset": preset,
        "n_total_compounds": n_candidates,
        "n_known_drugs_in_top10": known_in_top10,
        "n_perturbed_modules": len(perturbed),
        "feature_space": "disease-informed",
        "patient_top_k": patient_top_k,
        "boundary": BOUNDARY,
    }
    if meta:
        chain_meta.update(meta)
    return {
        "patient_id": patient_id,
        "disease": preset,
        "age": age,
        "sex": sex,
        "perturbed_modules": perturbed,
        "top_compounds": ranking,
        "mechanism_map": mechanism,
        "bootstrap_stability": bootstrap_stability or {},
        "meta": chain_meta,
    }
