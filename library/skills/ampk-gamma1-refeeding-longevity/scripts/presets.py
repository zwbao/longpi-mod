"""Ripa et al., Nature Aging 2023. Bins are from the methods paragraph. No slope was printed."""

from decimal import Decimal

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Results. PBMC qPCR cohort. Stays out of the personal report.
PBMC_DONORS = 93
PBMC_AGE_MIN = 65
PBMC_AGE_MAX = 90
# Fig. 6. R^2 values are printed on the figure. Slopes and intercepts are not.
R2_ON_FIGURE = ("0.0854", "0.0480", "0.0565", "0.0703", "0.0123", "0.0278", "0.121", "0.0008", "0.0774")
# Methods. MPI-1 0–0.33, MPI-2 0.34–0.66, MPI-3 0.67–1.0.
# Fig. 6g writes the high group as >0.66. The open interval between those two writings is not assigned.
MPI1_HI = Decimal("0.33")
MPI2_LO = Decimal("0.34")
MPI2_HI = Decimal("0.66")
MPI3_LO = Decimal("0.67")

DOMAINS = (
    ("adl", "日常生活活动"),
    ("iadl", "工具性日常生活活动"),
    ("spmsq", "简易智力状态"),
    ("cirs_ci", "累积疾病指数"),
    ("mna_sf", "简易营养评定"),
    ("ess", "Exton Smith 量表"),
    ("nm", "用药种数"),
    ("social", "社会支持"),
)

# Killifish survival counts on Fig. 5, not a human weight.
WILDTYPE_N = 80
UBI_R70Q_N = 92


def mpi_group(score: Decimal):
    if score < 0 or score > 1:
        return "out"
    if Decimal("0") <= score <= MPI1_HI:
        return "MPI-1"
    if MPI2_LO <= score <= MPI2_HI:
        return "MPI-2"
    if MPI3_LO <= score <= 1:
        return "MPI-3"
    if MPI2_HI < score < MPI3_LO:
        return "cutoff_conflict"
    return "gap"
