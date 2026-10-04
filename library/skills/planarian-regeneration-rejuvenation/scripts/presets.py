"""Dai et al., Nature Aging 2025. doi:10.1038/s43587-025-00847-9.

Directions are those written for Schmidtea mediterranea. Cohort rates stay out of the report.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Methods: cells kept after filtering.
COHORT_TOKEN = "104617"
# Results: PAG if |log2FC| > 0.25 and adjusted P < 0.05. The gene table is Supplementary Table 7.
PAG_LOG2FC = 0.25
PAG_PADJ = 0.05
# Fig. 3b: young LAF fertility average. Cohort rate, not a personal threshold.
FERTILITY_YOUNG_PERCENT = 59

REPORT_TITLE = "# 涡虫再生与组织回春"
TREATMENTS = ()

ITEMS = {
    "SOSd": {
        "aliases": ["SOSd", "sosd"],
        "sentence": "SOSd。正文写它在多数组织随年龄下降，再生后扳回。没有 log2FC 权重。",
    },
    "ndk": {
        "aliases": ["ndk", "NDK"],
        "sentence": "ndk。正文写它随年龄下降，再生后扳回。没有 log2FC 权重。",
    },
    "COX1": {
        "aliases": ["COX1", "cox1"],
        "sentence": "COX1。正文写它在神经和肌肉随年龄上升，再生后扳回。没有 log2FC 权重。",
    },
    "COX2": {
        "aliases": ["COX2", "cox2"],
        "sentence": "COX2。正文写它在神经和肌肉随年龄上升，再生后扳回。没有 log2FC 权重。",
    },
    "Smed-inr-1": {
        "aliases": ["Smed-inr-1", "inr-1", "Smed-inr-1"],
        "sentence": "Smed-inr-1。正文写它在肠道随年龄下降，再生后回升。没有 log2FC 权重。",
    },
    "Hspa8": {
        "aliases": ["Hspa8", "HSPA8"],
        "sentence": "Hspa8。正文写它在神经和肌肉随年龄上升，再生后扳回。没有 log2FC 权重。",
    },
    "wnt2": {
        "aliases": ["wnt2", "WNT2"],
        "sentence": "wnt2。正文写位置控制基因的表达有变化，没有在句子里给出它自己的方向。Supplementary Table 7 的 log2FC 列没有进入计算。",
    },
    "ndl-4": {
        "aliases": ["ndl-4", "ndl4"],
        "sentence": "ndl-4。正文写位置控制基因的表达有变化，没有在句子里给出它自己的方向。Supplementary Table 7 的 log2FC 列没有进入计算。",
    },
    "bwm1": {
        "aliases": ["bwm1", "BWM1"],
        "sentence": "bwm1。正文用它和 CA10 一起标记一类随年龄减少的体壁肌。没有单独的表达权重。",
    },
    "CA10": {
        "aliases": ["CA10", "ca10"],
        "sentence": "CA10。正文用它和 bwm1 一起标记一类随年龄减少的体壁肌。没有单独的表达权重。",
    },
    "UBAC1": {
        "aliases": ["UBAC1", "ubac1"],
        "sentence": "UBAC1。数据可用性写它的序列在 Supplementary Table 14。正文句子没有给出年龄方向，所以不写升降。",
    },
    "EEP": {
        "aliases": ["EEP", "异位眼", "异位眼或色素"],
        "sentence": "异位眼或色素。正文写它随年龄变多，截肢再生会减少这种眼表型。没有发病率权重。",
    },
    "fertility": {
        "aliases": ["fertility", "生育力", "孵化率"],
        "sentence": "生育力。正文写它随年龄下降，截肢再生之后回升。只有同时给出孵化卵囊和卵囊总数时才按正文定义做除法。",
    },
    "motility": {
        "aliases": ["motility", "运动", "运动距离"],
        "sentence": "运动距离。正文写年老个体比年轻个体走得少，再生之后回升。没有把队列里的路程套到你身上。",
    },
    "ROS": {
        "aliases": ["ROS", "活性氧", "CellROX"],
        "sentence": "活性氧。正文写年老个体氧化更高，再生之后这升高被扳回。没有荧光强度权重。",
    },
    "head-size": {
        "aliases": ["相对头大小", "relative head size", "head size"],
        "sentence": "相对头大小。正文写它随年龄变小。只有同时给出头部面积和全身面积时才按正文定义做除法。",
    },
}

FORMULAS = (
    {
        "num": ["头部面积", "head_area", "head area"],
        "den": ["全身面积", "body_area", "whole_body_area"],
        "label": "相对头大小",
        "note": "按正文的定义，相对头大小等于头部面积除以全身面积。正文写它随年龄变小。没有另给截断。",
        "missing_num": "算相对头大小缺头部面积。",
        "missing_den": "算相对头大小缺全身面积。",
    },
    {
        "num": ["孵化卵囊", "hatched", "hatched_capsules"],
        "den": ["卵囊总数", "egg_capsules", "total_capsules"],
        "label": "孵化比例",
        "note": "按正文的定义，生育力是孵化卵囊数除以卵囊总数。这是你给的两个数的比值。",
        "missing_num": "算孵化比例缺孵化卵囊数。",
        "missing_den": "算孵化比例缺卵囊总数。",
    },
)

MISSING = [
    "已打开的年龄相关基因表列是 versus、tissue、p_value、p_val_adj、avg_log2FC、gene。gene 是涡虫编号，不是人的基因符号，所以未点名的基因不按阈值分类，也不用 0 填充。文件里标成 Supplementary Table 7 的那张是 GO 术语，列是 GO_ID、GO_Term、AdjustedPv，不是 log2FC。",
    "已打开的 Supplementary Table 8 列是 Term、NES、P.Value、P.Adjusted，是功能富集，不是个人斜率。",
    "edgeR 模型里年龄斜率那一列没有出现在正文里，本次不算。",
]


def norm(text):
    return text.strip().casefold().replace(" ", "").replace("_", "").replace("-", "")


ALIAS = {}
for _item_id, _item in ITEMS.items():
    for _name in [_item_id, *_item["aliases"]]:
        ALIAS[norm(_name)] = _item_id


def resolve(raw):
    key = norm(raw)
    if key in ALIAS:
        return ALIAS[key]
    for prefix in ("hsa", "mmu"):
        if key.startswith(prefix) and key[len(prefix) :] in ALIAS:
            return ALIAS[key[len(prefix) :]]
    return None


def _guard():
    parts = [REPORT_TITLE, *MISSING]
    parts.extend(item["sentence"] for item in ITEMS.values())
    for spec in FORMULAS:
        parts.extend([spec["label"], spec["note"], spec["missing_num"], spec["missing_den"]])
    blob = "\n".join(parts)
    if COHORT_TOKEN in blob:
        raise SystemExit("cohort token in readout sentences")
    title = REPORT_TITLE.split(" ", 1)[1]
    if any(ch.isdigit() for ch in title):
        raise SystemExit("title has a digit")


_guard()
