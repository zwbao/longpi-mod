"""Wagner et al., Nature Biotechnology 2024. doi:10.1038/s41587-023-01751-6.

Numbers below are cited from the paper. They are not personal weights.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Results: 771 high-quality samples after dropping 26 low-quality samples. Supplementary Table 1.
COHORT_TOKEN = "771"
# Results: local aging |Spearman r| > 0.5 in at least one tissue; global = more than five tissues. Fig. 2.
SPEARMAN_CUTOFF = 0.5
# Fig. 2 legend: fold change versus 3 months, deregulated if FC < 2/3 or > 3/2.
FC_LOW = 2 / 3
FC_HIGH = 3 / 2
# Results: miRNA–mRNA target if r < -0.4 and P < 0.05.
TARGET_R = -0.4

REPORT_TITLE = "# 非编码核糖核酸衰老轨迹"
FORMULAS = ()
TREATMENTS = ()

ITEMS = {
    "miR-29a-3p": {
        "aliases": ["miR-29a-3p", "mmu-miR-29a-3p", "hsa-miR-29a-3p"],
        "sentence": "miR-29a-3p。正文写它在八个组织里与年龄正相关，并把它列为随年龄上升的全局衰老 miRNA。",
    },
    "miR-29c-3p": {
        "aliases": ["miR-29c-3p", "mmu-miR-29c-3p", "hsa-miR-29c-3p"],
        "sentence": "miR-29c-3p。正文写它与年龄的相关在固体器官、血浆和细胞外囊泡里最大，异时联体后是肝脏里最突出的、回到年轻水平的 miRNA，并列为随年龄上升的全局衰老 miRNA。",
    },
    "miR-155-5p": {
        "aliases": ["miR-155-5p", "mmu-miR-155-5p", "hsa-miR-155-5p"],
        "sentence": "miR-155-5p。正文把它列为随年龄上升的全局衰老 miRNA。",
    },
    "miR-184-3p": {
        "aliases": ["miR-184-3p", "mmu-miR-184-3p", "hsa-miR-184-3p"],
        "sentence": "miR-184-3p。正文把它列为随年龄上升的全局衰老 miRNA。",
    },
    "miR-1895": {
        "aliases": ["miR-1895", "mmu-miR-1895", "hsa-miR-1895"],
        "sentence": "miR-1895。正文把它列为随年龄上升的全局衰老 miRNA。",
    },
    "miR-300-3p": {
        "aliases": ["miR-300-3p", "mmu-miR-300-3p", "hsa-miR-300-3p"],
        "sentence": "miR-300-3p。正文写它在五个组织里与年龄负相关，并把它列为全局衰老 miRNA。",
    },
    "miR-487b-3p": {
        "aliases": ["miR-487b-3p", "mmu-miR-487b-3p", "hsa-miR-487b-3p"],
        "sentence": "miR-487b-3p。正文写它在五个组织里与年龄负相关，并把它列为全局衰老 miRNA。",
    },
    "miR-541-5p": {
        "aliases": ["miR-541-5p", "mmu-miR-541-5p", "hsa-miR-541-5p"],
        "sentence": "miR-541-5p。正文写它在五个组织里与年龄负相关，并把它列为全局衰老 miRNA。",
    },
    "Eln": {
        "aliases": ["Eln", "ELN"],
        "sentence": "Eln。图 3a 把 Eln、Col1a1 和 Col3a1 写成上升型全局 miRNA 的共有靶点，参与细胞外基质。没有靶点权重。",
    },
    "Col1a1": {
        "aliases": ["Col1a1", "COL1A1"],
        "sentence": "Col1a1。图 3a 把它写成上升型全局 miRNA 的共有靶点，参与细胞外基质。没有靶点权重。",
    },
    "Col3a1": {
        "aliases": ["Col3a1", "COL3A1"],
        "sentence": "Col3a1。图 3a 把它写成上升型全局 miRNA 的共有靶点，参与细胞外基质。没有靶点权重。",
    },
}

MISSING = [
    "Supplementary Table 8 已打开，列是 tissue、RNA、p_val、corr、p_adjust。这是小鼠各组织的相关，不乘到这个人的表达上，也不用 0 填充。",
    "Supplementary Table 3 的跨组织相关热图数值列没有进入计算。",
    "Supplementary Table 4 已打开，列是 tissue、timepoint、RNA、Foldchange、log2FC 和检验 P 值。那是小鼠时间点的倍数，不是这个人的表达分数。",
    "没有把单个表达值乘上相关系数，因为论文没有给出可套到一个人的截距。",
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
    blob = "\n".join([REPORT_TITLE, *MISSING, *[item["sentence"] for item in ITEMS.values()]])
    if COHORT_TOKEN in blob:
        raise SystemExit("cohort token in readout sentences")
    title = REPORT_TITLE.split(" ", 1)[1]
    if any(ch.isdigit() for ch in title):
        raise SystemExit("title has a digit")


_guard()
