"""Disease presets for SteeraMed Core.

Constants follow the 2026-09-21 alphaXiv manuscript
(2609.steeramed-biomedical-world-model-intervention) and the thresholds
recorded in DeepoMe/SteeraMed steeramed_core/core/config.py.

The manuscript does not apply SEMO_TOP_CHEM_PER_PPI or MAX_SEMO_PAIRS.
Those unused repository caps are intentionally absent here.
"""

from __future__ import annotations

SHARED = {
    "ppi_score_cutoff": 400,
    "ppi_min_size": 20,
    "ppi_max_size": 800,
    "stitch_score_cutoff": 200,
    "top_n_modules": 100,
    "top_n_features": 200,
    "patient_top_k": 50,
    "min_intersection": 3,
    "min_non_target": 3,
    "recall_ks": (5, 10, 20, 50),
    "individual_bootstrap_iters": 200,
    "group_bootstrap_iters": 100,
    "nominal_module_p": 0.05,
}

PRESETS = {
    "ra": {
        "label": "rheumatoid arthritis",
        "geo_dataset": "GSE42861",
        "delta_mode": "matched",
        "match_k": 10,
        "match_caliper": 5,
        "match_min_controls": 3,
        "chem_min_targets": 60,
        "chem_max_targets": 300,
    },
    "breast_cancer": {
        "label": "breast cancer",
        "geo_dataset": "GSE51032",
        "delta_mode": "matched",
        "match_k": 15,
        "match_caliper": 5,
        "match_min_controls": 3,
        "chem_min_targets": 60,
        "chem_max_targets": 300,
    },
    "depression": {
        "label": "major depressive disorder",
        "geo_dataset": "GSE128235",
        "delta_mode": "matched",
        "match_k": 10,
        "match_caliper": 5,
        "match_min_controls": 3,
        "chem_min_targets": 5,
        "chem_max_targets": None,
    },
    "aging": {
        "label": "healthy aging",
        "geo_dataset": "GSE40279",
        "delta_mode": "aging_young_mean",
        "young_max_exclusive": 50,
        "old_min_exclusive": 55,
        "chem_min_targets": 5,
        "chem_max_targets": None,
    },
}

ALIASES = {
    "ra": "ra",
    "rheumatoid_arthritis": "ra",
    "breast_cancer": "breast_cancer",
    "bc": "breast_cancer",
    "depression": "depression",
    "mdd": "depression",
    "aging": "aging",
    "age": "aging",
}


def resolve_preset(name: str) -> dict:
    key = ALIASES.get(name.strip().lower())
    if key is None:
        known = ", ".join(PRESETS)
        raise KeyError(f"Unknown preset '{name}'. Known presets: {known}")
    merged = dict(SHARED)
    merged.update(PRESETS[key])
    merged["preset"] = key
    return merged
