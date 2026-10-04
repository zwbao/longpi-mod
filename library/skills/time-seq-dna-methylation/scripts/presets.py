from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
from pathlib import Path

# Code availability and the repository README.
# Human blood clock age is in years. Mouse clocks other than rDNA are in months.
# Fig. 1h: TIME-seq rDNA clock, testing R = 0.95, MedAE = 1.95 months. Not this human-blood score.
RDNA_TEST_R = 0.95
RDNA_TEST_MEDAE_MONTHS = 1.95
RDNA_N_CPG = 232
ELASTIC_NET_ALPHA = 0.05
# Results, TIME-seq human blood clock. Cohort fit, not this person's error.
HUMAN_TRAIN_R = 0.98
HUMAN_TEST_R = 0.96
HUMAN_TEST_MEDAE_YEARS = 3.39
HUMAN_N = 1056
# Methods. Exclude a sample below this on-target read count.
READ_MINIMUM = 100000
# Methods. m_k is a methylation percentage.
METHYLATION_MIN = 0.0
METHYLATION_MAX = 100.0
# Repository example, TIME-Seq_Mouse_Blood_Clock, pool2_7 row.
MOUSE_EXAMPLE_SUM = -1.2931059486711043
MOUSE_EXAMPLE_AGE = 7.413145025886241
# Methods: coverage below 10 reads counts as low. Sample is dropped when low sites exceed 10% of clock CpGs.
LOW_COVERAGE = 10
LOW_FRACTION = 0.1

def load_clock(name: str) -> dict[str, float]:
    path = Path(__file__).resolve().parents[1] / "data" / name
    clock = {}
    for line in path.read_text(encoding="utf-8").splitlines()[1:]:
        site, coef = line.split("\t")
        clock[site] = float(coef)
    return clock

HUMAN = load_clock("TIME-Seq_Human_Blood_Clock.tsv")
MOUSE = load_clock("TIME-Seq_Mouse_Blood_Clock.tsv")


def cpgs(clock: dict[str, float]) -> list[str]:
    return [site for site in clock if site not in ("(Intercept)", "a", "c")]


def predict_from_sum(sum_weighted: float, clock: dict[str, float]) -> float:
    # example_clock_analysis.R: b = sum + intercept; age = a * b + c
    b = sum_weighted + clock["(Intercept)"]
    return clock["a"] * b + clock["c"]


def methylation_gap(values: dict[str, float], clock: dict[str, float]) -> str | None:
    needed = cpgs(clock)
    if any(site not in values for site in needed):
        return "missing"
    if any(values[site] < METHYLATION_MIN or values[site] > METHYLATION_MAX for site in needed):
        return "scale"
    return None


def predict_methylation(values: dict[str, float], clock: dict[str, float]) -> float | None:
    if methylation_gap(values, clock) is not None:
        return None
    total = sum(clock[site] * values[site] for site in cpgs(clock))
    return predict_from_sum(total, clock)
