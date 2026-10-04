"""Ping et al., Immunity 2026, doi:10.1016/j.immuni.2026.02.007.

Table S3 (mmc4.xlsx on the article page) lists Type, Cell type, Feature,
and Coefficient. pAge uses raw proportions, tAge uses log-transformed
expression, and TCRAge uses raw repertoire metrics. ptAge and immAge were
fit after cohort min-max scaling; those minima and maxima are not in the
table. bulk-immAge is not in the table. Figure metrics are cohort results,
not personal weights.
"""

from __future__ import annotations

from decimal import Decimal

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。"
    "pAge、tAge 和 TCRAge 按 Table S3 的系数计算。"
    "ptAge 和 immAge 缺训练集的缩放范围，bulk-immAge 的系数不在 Table S3，这三项不算。"
    "不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。"
    "体检不增删方法算出的名单。"
)
UNREADABLE = "读不了这种格式，请改交表格。"
PAGE_INPUT = "输入是原始细胞比例。"
TAGE_INPUT = "输入是对数转换后的表达，技能没有再取一次对数。"
TCR_INPUT = "输入是原始 TCR 指标，性别按女为 0、男为 1。"
PT_SKIP = "ptAge：没有算。Table S3 有系数，缺每个特征在训练集上的最小值和最大值。"
IMM_SKIP = "immAge：没有算。Table S3 有系数，缺每个特征在训练集上的最小值和最大值。"
BULK_SKIP = "bulk-immAge：没有算。系数不在 Table S3。"
SEX_CODE = "性别按女为 0、男为 1。"

DOI = "10.1016/j.immuni.2026.02.007"
DOI_URL = "https://doi.org/10.1016/j.immuni.2026.02.007"
ARTICLE_URL = "https://www.cell.com/immunity/abstract/S1074-7613(26)00077-4"
TABLE_S3_URL = (
    "https://www.cell.com/cms/10.1016/j.immuni.2026.02.007/attachment/"
    "76405a68-30d3-44c4-ba98-70680c4cd09c/mmc4.xlsx"
)
REPO = "https://github.com/PINGjl/Immune-clock"
CARD_TITLE = "人类免疫衰老时钟指出 RUNX1 会减缓 T 细胞衰老"
CARD_CITE = "Ping 等。Immunity，2026，59(4): 1039–1057.e11。doi:10.1016/j.immuni.2026.02.007。"
CARD_SUMMARY = (
    "这项研究纳入 230 名 20 到 84 岁的健康人，对近 120 万个外周血单个核细胞做单细胞转录组和 T、B 细胞受体测序，并据此预测年龄。"
    "T 细胞的转录组贡献最大。"
    "转录因子 RUNX1 在 T 细胞里随年龄下降。"
    "年轻 T 细胞敲低 RUNX1 后出现衰老表型，老年 CD8+ T 细胞补回 RUNX1 后衰老减轻。"
)

FULL_TEXT_READ = True
TABLE_S3_ROWS = 18851
SEX_FEMALE = 0
SEX_MALE = 1

# STAR Methods. Not applied as a personal score by themselves.
N_ALPHAS = 99
ALPHA_MIN = Decimal("0.01")
ALPHA_MAX = Decimal("0.99")
ALPHA_STEP = Decimal("0.01")
CV_FOLDS = 10
PAPER_TRAIN_FRACTION = Decimal("0.5")
PAPER_SPLIT = "按性别随机分成训练集和验证集，各约一半"
CODE_SEED = 2024
CODE_SPLIT = "set.seed(2024)，按性别和 5 岁年龄段 sample_frac(0.5)"
PAPER_TAIL_FRACTION = Decimal("0.20")
DELTA_CLOCK_MIN = 7
CODE_EACH_TAIL = 21

# Results. Each value stays tied to its figure. These are not personal ages.
FIGURES = (
    ("图2B", "pAge", "MAE", Decimal("8.48")),
    ("图2C", "Th2 的 tAge", "MAE", Decimal("4.96")),
    ("图2C与图S2A", "各细胞类型 tAge", "MAE下界", Decimal("4.96")),
    ("图2C与图S2A", "各细胞类型 tAge", "MAE上界", Decimal("9.86")),
    ("图2D与图S2B", "tAge 非零系数基因", "平均个数", Decimal("606")),
    ("图2E", "T细胞 ptAge", "MAE", Decimal("5.44")),
    ("图S2A", "TCRAge", "MAE", Decimal("12.07")),
    ("图2F", "immAge", "R", Decimal("0.90")),
    ("图2F", "immAge", "MAE", Decimal("5.66")),
    ("图2H", "bulk-immAge 对 immAge", "R", Decimal("0.89")),
)


def linear_score(coefficients: dict[str, Decimal], values: dict[str, Decimal]) -> Decimal:
    """Intercept plus the sum of coefficient times the supplied value.

    Table S3 has one row per feature. Missing features are the caller's problem;
    this function does not fill them with zero.
    """
    total = coefficients["(Intercept)"]
    for name, coef in coefficients.items():
        if name == "(Intercept)":
            continue
        total += coef * values[name]
    return total


def aging_pace(chronological: list[Decimal], predicted: list[Decimal]) -> list[Decimal]:
    """Residual of predicted age on chronological age.

    STAR Methods define this on the validation set. One person does not have
    that regression, so personal reports do not call this function.
    """
    n = len(chronological)
    if n != len(predicted) or n < 2:
        raise ValueError("需要至少两个配对的实足年龄和预测年龄")
    mean_x = sum(chronological, Decimal(0)) / n
    mean_y = sum(predicted, Decimal(0)) / n
    ss = sum((x - mean_x) ** 2 for x in chronological)
    if ss == 0:
        raise ValueError("实足年龄没有变异")
    slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(chronological, predicted)) / ss
    intercept = mean_y - slope * mean_x
    return [y - (slope * x + intercept) for x, y in zip(chronological, predicted)]
