"""Lindbohm et al., Nature Aging 2022, doi:10.1038/s43587-022-00293-x. PMC10154235."""

from __future__ import annotations

BOUNDARY = '这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。'

BIOMARKERS_SCREENED = 1827
BIOMARKERS_ASSOCIATED = 127
PATHWAY_BIOMARKERS = 78
IPW_N = 117773
METHOTREXATE_HR = 0.64
METHOTREXATE_CI = (0.49, 0.88)
WEIGHTS_PRESENT = False

MEDICATIONS = {
    "甲氨蝶呤": "甲氨蝶呤",
    "methotrexate": "甲氨蝶呤",
    "柳氮磺吡啶": "柳氮磺吡啶类",
    "美沙拉秦": "柳氮磺吡啶类",
    "sulfasalazine": "柳氮磺吡啶类",
    "布洛芬": "非甾体抗炎药",
    "萘普生": "非甾体抗炎药",
    "双氯芬酸": "非甾体抗炎药",
    "塞来昔布": "非甾体抗炎药",
    "阿司匹林": "非甾体抗炎药",
    "ibuprofen": "非甾体抗炎药",
    "氯雷他定": "抗组胺药",
    "西替利嗪": "抗组胺药",
    "泼尼松": "糖皮质激素",
    "地塞米松": "糖皮质激素",
    "依那西普": "肿瘤坏死因子抑制剂",
    "阿达木单抗": "肿瘤坏死因子抑制剂",
    "英夫利西单抗": "肿瘤坏死因子抑制剂",
}
CATEGORIES = (
    "甲氨蝶呤",
    "柳氮磺吡啶类",
    "非甾体抗炎药",
    "抗组胺药",
    "糖皮质激素",
    "肿瘤坏死因子抑制剂",
)
