"""Thomson et al., Nature Immunology 2023. doi:10.1038/s41590-023-01641-8.

Directions are those written for human T cells. Group frequencies are not personal cutoffs.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Results: T cells in the TEA-seq discovery set.
COHORT_TOKEN = "324255"
# Fig. 5d: MNP-2 frequency within naive CD8 cells, children then adults. Cohort medians, not a cutoff.
MNP2_CHILD_PERCENT = 3.3
MNP2_ADULT_PERCENT = 0.8
# Methods: MAST DEG if Padj < 0.05 and log(fold change) > 0.1.
MAST_LOGFC = 0.1
MAST_PADJ = 0.05

REPORT_TITLE = "# T细胞年龄分子重编程"
FORMULAS = ()
TREATMENTS = ()

ITEMS = {
    "TOX": {
        "aliases": ["TOX", "Tox"],
        "sentence": "TOX。正文写它是初始 CD4 T 细胞的儿童签名，在脐带血较高，并随年龄下降。没有倍数权重。",
    },
    "SOX4": {
        "aliases": ["SOX4", "Sox4"],
        "sentence": "SOX4。正文写它是初始 CD4 T 细胞的儿童签名，在脐带血较高，并随年龄下降。没有倍数权重。",
    },
    "DACH1": {
        "aliases": ["DACH1", "Dach1"],
        "sentence": "DACH1。图 4a 把它和 SOX4、TOX 一起举例为儿童富集的基因。没有倍数权重。",
    },
    "CPQ": {
        "aliases": ["CPQ"],
        "sentence": "CPQ。正文写它是年长成人签名，随年龄逐步升高。没有倍数权重。",
    },
    "STAT4": {
        "aliases": ["STAT4"],
        "sentence": "STAT4。正文写它是年长成人签名，随年龄逐步升高。没有倍数权重。",
    },
    "INPP4B": {
        "aliases": ["INPP4B"],
        "sentence": "INPP4B。图 4a 把它举例为成人富集的基因。没有倍数权重。",
    },
    "MNP-2": {
        "aliases": ["MNP-2", "MNP2", "CD8aa", "CD8αα"],
        "sentence": "MNP-2。正文写这个儿童 CD8αα 样亚群随年龄减少。认出它用的是 KLRC3、LEF1 和 CD8A 同时表达，表面较高的是 CD244 和 CD11b。没有频率阈值。",
    },
    "KLRC3": {
        "aliases": ["KLRC3"],
        "sentence": "KLRC3。正文用它和 LEF1、CD8A 一起在单细胞数据里认出 MNP-2。单独一个基因不是权重。",
    },
    "LEF1": {
        "aliases": ["LEF1", "Lef1"],
        "sentence": "LEF1。正文用它和 KLRC3、CD8A 一起认出 MNP-2，初始样记忆 CD8 亚群也表达它。单独一个基因不是权重。",
    },
    "CD8A": {
        "aliases": ["CD8A", "CD8a"],
        "sentence": "CD8A。正文用它和 KLRC3、LEF1 一起认出 MNP-2。单独一个基因不是权重。",
    },
    "CD244": {
        "aliases": ["CD244"],
        "sentence": "CD244。正文写 MNP-2 表面 CD244 高，分选表型还要求 CD11b 阳性、CD8 阳性、CD4 阴性。没有频率阈值。",
    },
    "CD11b": {
        "aliases": ["CD11b", "ITGAM"],
        "sentence": "CD11b。正文写 MNP-2 表面 CD11b 高。没有频率阈值。",
    },
    "BACH2": {
        "aliases": ["BACH2"],
        "sentence": "BACH2。正文写初始样记忆 CD8 亚群共有这个静息相关转录因子。它不是 MNP-2 独有的权重。",
    },
    "FOXP1": {
        "aliases": ["FOXP1"],
        "sentence": "FOXP1。正文写初始样记忆 CD8 亚群共有这个静息相关转录因子。它不是 MNP-2 独有的权重。",
    },
    "CD8-SCM": {
        "aliases": ["CD8 SCM", "CD8SCM", "干细胞样记忆"],
        "sentence": "CD8 干细胞样记忆细胞。正文写这一亚群的频率随年龄升高。没有把组频率当成个人阈值。",
    },
    "MNP-1": {
        "aliases": ["MNP-1", "MNP1"],
        "sentence": "MNP-1。正文写它的频率随年龄升高，并和记忆细胞更接近。没有频率阈值。",
    },
}

MISSING = [
    "Supplementary Table 2 已打开。它是初始 CD8 的差异基因，列有 avg_log2FC、cluster、gene。这不是九个亚群的频率阈值，也不把倍数乘成个人分数。",
    "Supplementary Table 1 的九个亚群完整标记列没有进入计算。正文只写了部分门控。",
    "没有把两组的频率差做成判断一个人属于儿童或成人的系数。",
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
