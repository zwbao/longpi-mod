"""Ximerakis et al., Nature Aging 2023. doi:10.1038/s43587-023-00373-6.

Directions below are the ones written in the results text or left unsigned
when only Fig. 4e shows the symbol. They are not log fold-change weights.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Results and Fig. 1: cells retained after filtering.
COHORT_TOKEN = "105329"
# Fig. 4: DGE at FDR <= 0.05. Methods: Benjamini–Hochberg p_adj.loc.
FDR = 0.05
# Results: 41 bidirectional genes; 34 down in RJV and up in AGA. Full list is Supplementary Table 14.
BIDIRECTIONAL_GENES = 41
RJV_DOWN_AGA_UP = 34

REPORT_TITLE = "# 异时联体脑转录组"
FORMULAS = ()
TREATMENTS = ()

_DOWN = (
    "Maff",
    "Hsp90aa1",
    "Hspa1a",
    "Adamts1",
    "Apold1",
    "Cyr61",
    "Dusp1",
    "Stmn2",
)
_FIG4E_UNSIGNED = (
    "Gm26917",
    "Rpl23a",
    "8430408G22Rik",
    "Btg2",
    "Cdk19",
    "Mat2a",
    "mt-Nd4l",
)

ITEMS = {}
for _symbol in _DOWN:
    _aliases = [_symbol, _symbol.upper(), _symbol[:1].upper() + _symbol[1:]]
    if _symbol == "Adamts1":
        _aliases.append("Adamsts1")
    ITEMS[_symbol] = {
        "aliases": _aliases,
        "sentence": (
            f"{_symbol}。正文写它在内皮细胞里随年龄上升，回春对比里下降，衰老加速对比里上升。"
            "没有 log(FC) 权重。"
        ),
    }

ITEMS["Klf6"] = {
    "aliases": ["Klf6", "KLF6"],
    "sentence": "Klf6。正文写它是内皮细胞里随年龄上升最明显的转录因子之一，回春对比里下降，原位杂交把它拉回到接近年轻内皮细胞的水平。没有 puncta 权重。",
}
ITEMS["Smad7"] = {
    "aliases": ["Smad7", "SMAD7"],
    "sentence": "Smad7。正文写它是 Klf6 的下游，在回春对比里下降。没有 log(FC) 权重。",
}
ITEMS["Avp"] = {
    "aliases": ["Avp", "AVP"],
    "sentence": "Avp。正文写它随年龄下降，异时联体后在年老小鼠里上升。没有 log(FC) 权重。",
}
ITEMS["Ivns1ab"] = {
    "aliases": ["Ivns1ab", "IVNS1AB"],
    "sentence": "Ivns1ab。正文写它随年龄下降，异时联体后上升。没有 log(FC) 权重。",
}
ITEMS["Apoe"] = {
    "aliases": ["Apoe", "APOE"],
    "sentence": "Apoe。正文写它在多个细胞类型的回春对比里失调，没有给出统一方向。Supplementary Table 15 和 16 的列没有进入计算。",
}
ITEMS["Clu"] = {
    "aliases": ["Clu", "CLU"],
    "sentence": "Clu。正文写它在多个细胞类型的回春对比里失调，没有给出统一方向。Supplementary Table 15 和 16 的列没有进入计算。",
}
ITEMS["Pecam1"] = {
    "aliases": ["Pecam1", "PECAM1"],
    "sentence": "Pecam1。正文用它标出内皮细胞，再在这些细胞里看 Klf6 和 Hspa1a。没有把 Pecam1 本身写成回春方向。",
}
for _symbol in _FIG4E_UNSIGNED:
    ITEMS[_symbol] = {
        "aliases": [_symbol, _symbol.upper()],
        "sentence": (
            f"{_symbol}。图 4e 把它列在内皮细胞双向基因的标签里。"
            "正文没有逐个写出 log(FC) 的符号。已打开的双向基因表按细胞类型列出基因名，没有 log(FC) 列，所以不写升降。"
        ),
    }
ITEMS["Cdkn1a"] = {
    "aliases": ["Cdkn1a", "CDKN1A"],
    "sentence": "Cdkn1a。方法用了它的原位杂交探针。正文句子没有给出回春对比里的 log(FC)。已打开的双向基因表没有 log(FC) 列，所以不写升降。",
}

MISSING = [
    "已打开的双向基因表（两张表，列是 gene 和各细胞类型）没有 log(FC)。MOESM2 是细胞标记的 avg_log2FC，MOESM3 是方差分析。它们都不是 Supplementary Table 14 的倍数。名单只保留正文或图 4e 点名的符号，不用 0 填充倍数。",
    "Supplementary Tables 3 到 11 的各细胞类型 log(FC) 与 p_adj.loc 列没有进入计算。",
    "回春对比和衰老加速对比是小鼠假批量设计，没有可套到一个人的截距。",
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
