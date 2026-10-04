from __future__ import annotations

import math
import statistics
from pathlib import Path

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Fig. 3A, B. Weeks. Cohort errors, not this person's residual.
CV_MAE_BLOOD_WEEKS = 8.2
CV_MAE_LIVER_WEEKS = 3.9
FINAL_MAE_BLOOD_WEEKS = 8.2
FINAL_MAE_LIVER_WEEKS = 4.6
# Fig. 3C, D.
LEFTOUT_MAE_LIVER_WEEKS = 5
LEFTOUT_MAE_BLOOD_WEEKS = 10
# Comparison on n = 63 shared training samples. Not the blood model.
STUBBS_MAE_WEEKS = 0.8
SCEPIAGE_LIVER_MAE_ON_SHARED = 3.0
SHARED_N = 63
# Methods. Both blood and liver selected this many sites.
OPTIMAL_SITES = 750
# predictAges in scEpiAge/PredictionFunctions/functions.R. Not printed in the paper.
MIN_SITES = 5

_DATA = Path(__file__).resolve().parents[1] / "data"


def _load():
    ages = []
    expected = {}
    with (_DATA / "ExpectedMethMat_Blood.tsv").open(encoding="utf-8") as handle:
        header = handle.readline().rstrip("\n").split("\t")
        ages = tuple(int(item) for item in header if item)
        for line in handle:
            parts = line.rstrip("\n").split("\t")
            expected[parts[0]] = tuple(float(item) for item in parts[1:])
    primary = []
    seen = set()
    pairs = []
    with (_DATA / "clockSites_Blood_BackUp.txt").open(encoding="utf-8") as handle:
        next(handle)
        for line in handle:
            left, right = line.rstrip("\n").split("\t")
            if left not in seen:
                seen.add(left)
                primary.append(left)
            if right and right != "-":
                pairs.append((left, right))
    return ages, expected, tuple(primary), tuple(pairs)


AGES, EXPECTED, PRIMARY, BACKUPS = _load()


def sites_for(observed: dict[str, float]) -> list[str]:
    clean = {
        site: value
        for site, value in observed.items()
        if site in EXPECTED and 0.0 <= value <= 1.0
    }
    used = [site for site in PRIMARY if site in clean]
    used_set = set(used)
    filled = set(used)
    for primary, backup in BACKUPS:
        if primary in filled:
            continue
        if backup in clean and backup not in used_set:
            used.append(backup)
            used_set.add(backup)
            filled.add(primary)
    return used


def predict_age(observed: dict[str, float]) -> tuple[int, list[str]] | None:
    # functions.R: sum(log(1 - |expected - observed|)); floor(median of weeks at the maximum)
    used = sites_for(observed)
    if len(used) < MIN_SITES:
        return None
    clean = {site: observed[site] for site in used}
    scores = []
    for column, age in enumerate(AGES):
        total = 0.0
        for site in used:
            gap = abs(EXPECTED[site][column] - clean[site])
            if gap >= 1.0:
                total = float("-inf")
                break
            total += math.log(1.0 - gap)
        scores.append((total, age))
    best = max(score for score, _age in scores)
    if best == float("-inf"):
        return None
    chosen = [age for score, age in scores if score == best]
    return math.floor(statistics.median(chosen)), used
