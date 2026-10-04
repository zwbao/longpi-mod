"""Civiletto et al., Nature Aging 2025, doi:10.1038/s43587-025-00957-4.

Named activators are from the main text. MOESM3 Table 2 Rank column places carvacrol first and thymol second. Those zebrafish means are not personal scores.
Epigenetic clocks use HorvathMammalMethyl40; weights were not printed.
Fig. 7a: SAMP8, n = 15 per group. GEO accessions GSE298195 and GSE298196.
The 20 mg/kg/day gavage is an experimental dose, not a personal instruction.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "# 草本萜类与自噬"

GSE_MUSCLE = "GSE298195"
GSE_OTHER = "GSE298196"
SAMP8_PER_GROUP = 15
TABLE2_N = 57
CARVACROL_RANK = 1
THYMOL_RANK = 2
MOUSE_MG_PER_KG_PER_DAY = 20
WEIGHTS_PRESENT = False

COMPOUNDS = (
    {
        "display": "百里香酚（thymol）",
        "note": "筛库里自噬激活最强的两个萜类之一，并在细胞里促进线粒体自噬。",
        "aliases": ("百里香酚", "百里酚", "thymol", "麝香草酚"),
    },
    {
        "display": "香芹酚（carvacrol）",
        "note": "与百里香酚一起被点名为自噬和线粒体自噬激活物。",
        "aliases": ("香芹酚", "carvacrol"),
    },
    {
        "display": "百里香酚硫酸酯（thymol sulfate）",
        "note": "人血里常见的结合产物，细胞实验里仍能诱导自噬。",
        "aliases": ("百里香酚硫酸酯", "thymol sulfate", "thymolsulfate"),
    },
    {
        "display": "百里香酚葡萄糖醛酸苷（thymol glucuronide）",
        "note": "人血里常见的结合产物，细胞实验里仍能诱导自噬。",
        "aliases": ("百里香酚葡萄糖醛酸苷", "thymol glucuronide", "thymolglucuronide"),
    },
    {
        "display": "牛至精油（oregano essential oil）",
        "note": "含百里香酚和香芹酚的精油，在斑马鱼里增加自噬流。",
        "aliases": ("牛至精油", "牛至油", "oregano essential oil", "oregano"),
    },
    {
        "display": "神经酰胺（ceramide）",
        "note": "试点筛里已经知道能诱导自噬的三个分子之一。",
        "aliases": ("神经酰胺", "ceramide"),
    },
    {
        "display": "calpeptin",
        "note": "试点筛里已经知道能诱导自噬的三个分子之一。",
        "aliases": ("calpeptin",),
    },
    {
        "display": "视黄酸（retinoic acid）",
        "note": "试点筛里已经知道能诱导自噬的三个分子之一。",
        "aliases": ("视黄酸", "维甲酸", "retinoic acid", "tretinoin"),
    },
)
