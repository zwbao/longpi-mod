"""Aguado et al., Nature Aging 2023, doi:10.1038/s43587-023-00519-6.

Organoid and mouse concentrations are the Methods paragraphs. The ranking score is the printed formula −(P)×sign(logFC). Group size 16 is the in vivo allocation sentence and stays out of the personal report. Supplementary Table 1 columns are Primer, Target, Sequence.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

NAVITOCLAX_ORGANOID_UM = 2.5
ABT737_ORGANOID_UM = 10
DASATINIB_ORGANOID_UM = 10
QUERCETIN_ORGANOID_UM = 25
NAVITOCLAX_MOUSE_MG_PER_KG = 100
DASATINIB_MOUSE_MG_PER_KG = 5
QUERCETIN_MOUSE_MG_PER_KG = 50
FISETIN_MOUSE_MG_PER_KG = 100
GROUP_N = 16

ALIASES = {
    "纳维托克": ["纳维托克", "navitoclax", "ABT-263", "ABT263"],
    "ABT-737": ["ABT-737", "ABT737"],
    "达沙替尼": ["达沙替尼", "dasatinib", "sprycel"],
    "槲皮素": ["槲皮素", "quercetin"],
    "非瑟酮": ["非瑟酮", "fisetin"],
}
