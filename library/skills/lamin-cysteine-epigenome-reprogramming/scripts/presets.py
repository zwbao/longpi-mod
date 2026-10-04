"""Wang et al., Nature Metabolism 2026. doi:10.1038/s42255-025-01443-2.

Directions are those written for mouse embryonic stem cells and aged cardiomyocytes.
No flux coefficient is stored here.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Methods, 10x: cells loaded from day-10 embryoid bodies. Not a human cohort weight.
COHORT_TOKEN = "8000"
# Fig. 1d and Fig. 1n: n = 6 biological replicates for metabolite panels.
METABOLITE_REPLICATES = 6

REPORT_TITLE = "# 核纤层半胱氨酸与干细胞命运"
FORMULAS = ()
TREATMENTS = (
    "UNC1999",
    "Chaetocin",
    "Trichostatin A",
    "曲古抑菌素",
    "doxycycline",
    "多西环素",
)

ITEMS = {
    "CTH": {
        "aliases": ["CTH", "Cth", "CSE", "胱硫醚γ裂解酶"],
        "sentence": "CTH。正文写 Lmna 缺失的胚胎干细胞里，CTH 的转录、蛋白和酶活性上升；携带早衰突变时 CTH 下降。没有通量权重。",
    },
    "CBS": {
        "aliases": ["CBS", "Cbs", "胱硫醚β合酶"],
        "sentence": "CBS。正文写 Lmna 缺失时 CBS 的转录、蛋白和酶活性上升；携带早衰突变时 CBS 下降。没有通量权重。",
    },
    "SP1": {
        "aliases": ["SP1", "Sp1"],
        "sentence": "SP1。正文写 Lmna 缺失时 SP1 在 Cth 和 Cbs 启动子上的结合增加，沉默 Sp1 会把这两条转录拉低。没有结合分数的系数。",
    },
    "cysteine": {
        "aliases": ["cysteine", "L-cysteine", "半胱氨酸"],
        "sentence": "半胱氨酸。摘要写 Lmna 缺失促进从头合成半胱氨酸。早衰突变怎样改写一个人的浓度，正文没有给出可套用的系数。",
    },
    "cystine": {
        "aliases": ["cystine", "L-cystine", "胱氨酸"],
        "sentence": "胱氨酸。正文把它和半胱氨酸、胱硫醚一起写成 Lmna 缺失时变化最大的中间物。没有可套到个人化验的系数。",
    },
    "cystathionine": {
        "aliases": ["cystathionine", "L-cystathionine", "胱硫醚"],
        "sentence": "胱硫醚。正文把它和半胱氨酸、胱氨酸一起写成 Lmna 缺失时变化最大的中间物。没有可套到个人化验的系数。",
    },
    "acetyl-CoA": {
        "aliases": ["acetyl-CoA", "acetylcoa", "乙酰辅酶A"],
        "sentence": "乙酰辅酶 A。摘要写增加的半胱氨酸通量进入乙酰辅酶 A，并促进 H3K9 与 H3K27 乙酰化。没有把浓度乘上通量系数。",
    },
    "H3K9ac": {
        "aliases": ["H3K9ac"],
        "sentence": "H3K9ac。摘要写半胱氨酸通量促进 H3K9 乙酰化。没有个人回归权重。",
    },
    "H3K27ac": {
        "aliases": ["H3K27ac"],
        "sentence": "H3K27ac。摘要写半胱氨酸通量促进 H3K27 乙酰化。没有个人回归权重。",
    },
    "H3K9me3": {
        "aliases": ["H3K9me3"],
        "sentence": "H3K9me3。摘要写早衰突变改变 H3K9 乙酰化与甲基化的平衡；讨论写年老心肌细胞里 H3K9me3 升高。没有可套用的系数。",
    },
    "LMNA": {
        "aliases": ["LMNA", "Lmna", "lamin A", "核纤层蛋白A", "核纤层"],
        "sentence": "LMNA。这是被研究的核纤层基因。正文没有给出可套到一个人的截距。",
    },
}

MISSING = [
    "Supplementary Table 1 已打开。列是 Metabolites，以及胚胎干细胞野生型和敲除的重复强度。那不是个人系数，也不把化验值换算成乙酰化。",
    "图 1n 的半胱氨酸、丙酮酸和乙酰辅酶 A 相对丰度没有在正文给出可套用的数字。",
    "没有半胱氨酸浓度到组蛋白乙酰化的截距或斜率。",
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
