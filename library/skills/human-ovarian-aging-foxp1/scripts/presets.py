"""Age groups and cell-type markers printed by Wu et al., Nature Aging 2024."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Extended Data Fig. 3b: DEG count for one contrast. Cohort tally, not a personal score.
DEG_COUNT = "1068"

GROUPS = (
    ("年轻", 18, 28, "正文的年轻组是 18 到 28 岁。"),
    ("中年", 36, 39, "正文的中年组是 36 到 39 岁。"),
    ("年长", 47, 49, "正文的年长组是 47 到 49 岁。"),
)

CELLS = {
    "gc": "颗粒细胞。正文写的标志是 GSTA1、AMH 和 HSD17B1。",
    "oo": "卵母细胞。正文写的标志是 TUBB8、ZP3 和 FIGLA。",
    "ts": "卵泡膜和基质细胞。正文写的标志是 DCN 和 STAR。",
    "smc": "平滑肌细胞。正文写的标志是 ACTA2 和 MUSTN1。",
    "ec": "内皮细胞。正文写的标志是 TM4SF1 和 VWF。",
    "mono": "单核细胞。正文写的标志是 TYROBP 和 IFI30。",
    "nk": "自然杀伤细胞。正文写的标志是 CCL5 和 NKG7。",
    "t": "T 淋巴细胞。正文写的标志是 IL7R 和 KLRB1。",
}

CELL_ALIASES = {
    "gc": "gc",
    "granulosa": "gc",
    "颗粒": "gc",
    "颗粒细胞": "gc",
    "oo": "oo",
    "oocyte": "oo",
    "卵母": "oo",
    "卵母细胞": "oo",
    "ts": "ts",
    "theca": "ts",
    "stroma": "ts",
    "卵泡膜": "ts",
    "基质": "ts",
    "smc": "smc",
    "平滑肌": "smc",
    "ec": "ec",
    "endothelial": "ec",
    "内皮": "ec",
    "mono": "mono",
    "monocyte": "mono",
    "单核": "mono",
    "单核细胞": "mono",
    "nk": "nk",
    "t": "t",
    "淋巴细胞": "t",
}

NAMED = {
    "foxp1": "FOXP1 随年龄下降，并抑制 CDKN1A 转录。沉默它在小鼠里导致早发性卵巢功能不全。这不是个人表达分数。",
    "cdkn1a": "CDKN1A 在各卵巢细胞类型里随年龄升高。正文没有给出个人倍数。",
    "star": "卵泡膜和基质亚型 1 的正文标志包括 STAR 和 CYB5A。",
    "cyb5a": "卵泡膜和基质亚型 1 的正文标志包括 STAR 和 CYB5A。",
}
