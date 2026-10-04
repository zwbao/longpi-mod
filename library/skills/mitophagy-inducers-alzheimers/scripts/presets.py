"""Xie et al., Nature Biomedical Engineering 2022, doi:10.1038/s41551-021-00819-5.

Names and roles are from the main text (Fig. 2 and the results that follow).
Similarity threshold 0.75 and library size 3274 are main-text counts, not personal scores.
Methods later writes 3724 for the same library. MOESM3 has pairwise similarities among 18 IDs and no name column.
Code is not in a public repository.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "# 线粒体自噬诱导物的名单"

# Main text: Macau Library size. Methods repeats the screen as 3724.
MACAU_LIBRARY_N = 3274
MACAU_LIBRARY_N_METHODS = 3724
REFERENCE_INDUCERS_N = 14
SIMILARITY_CUTOFF = 0.75
SELECTED_N = 18
CELL_POSITIVE_N = 8
# Mouse gavage in the Fig. 3n legend. Not a personal dose.
MOUSE_MG_PER_KG_PER_DAY = 100

WEIGHTS_PRESENT = False

COMPOUNDS = (
    {
        "display": "山奈酚（Kaempferol）",
        "note": "细胞、线虫神经元和阿尔茨海默病模型里都诱导线粒体自噬，并改善动物的记忆读出。",
        "aliases": ("山奈酚", "山柰酚", "kaempferol", "kaem", "t2177", "t-2177"),
    },
    {
        "display": "丹叶大黄素（Rhapontigenin）",
        "note": "细胞、线虫神经元和阿尔茨海默病模型里都诱导线粒体自噬，并改善动物的记忆读出。",
        "aliases": ("丹叶大黄素", "rhapontigenin", "rhap", "t3776", "t-3776"),
    },
    {
        "display": "槲皮素（Quercetin）",
        "note": "细胞和线虫神经元里诱导线粒体自噬。β淀粉样线虫的联想记忆读出没有恢复。",
        "aliases": ("槲皮素", "quercetin", "t2174", "t-2174"),
    },
    {
        "display": "槲皮素二水合物（Quercetin dihydrate）",
        "note": "细胞里的结果与槲皮素接近，后面没有再单独做下去。",
        "aliases": ("槲皮素二水合物", "quercetin dihydrate", "quercetindihydrate", "t6630", "t-6630"),
    },
    {
        "display": "他克莫司（Tacrolimus）",
        "note": "细胞里诱导线粒体自噬，线虫神经元里没有。",
        "aliases": ("他克莫司", "tacrolimus", "fk506", "t2144", "t-2144"),
    },
    {
        "display": "子囊霉素（Ascomycin）",
        "note": "细胞里诱导线粒体自噬，线虫神经元里没有。",
        "aliases": ("子囊霉素", "ascomycin", "t2481", "t-2481"),
    },
    {
        "display": "异鼠李素（Isorhamnetin）",
        "note": "细胞里诱导线粒体自噬，线虫神经元里没有。",
        "aliases": ("异鼠李素", "isorhamnetin", "t2836", "t-2836"),
    },
    {
        "display": "Pinostilbene",
        "note": "细胞里诱导线粒体自噬，线虫神经元里没有。",
        "aliases": ("pinostilbene", "t3755", "t-3755"),
    },
)

# IDs in MOESM3 that the main text does not name.
UNNAMED_IDS = (
    "T0579",
    "T2910",
    "T0610",
    "T0879",
    "T2879",
    "T1723",
    "T3814",
    "T3S1068",
    "T7052",
    "T3843",
)
