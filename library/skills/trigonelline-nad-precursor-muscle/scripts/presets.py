"""Assay concentrations from Membrez et al., Nature Metabolism 2024.

EC50 values are in the human myotube paragraph. The mouse dose is in the methods treatment paragraph.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

EC50_CONTROL_UM = 315
EC50_FK866_UM = 110
MOUSE_DOSE_MG_PER_KG = 300
BUSHEHR_N = 186

PRECURSORS = (
    ("葫芦巴碱", "血清水平在肌少症中更低，并与肌肉质量、握力和步速同向。Fig. 1。"),
    ("烟酸", "Preiss–Handler 途径的对照前体。肌管里 NAPRT 敲低会挡住烟酸和葫芦巴碱产生 NAD+。"),
    ("烟酰胺", "挽救实验里的 NAD+ 前体对照之一。"),
    ("烟酰胺核糖", "不依赖 NAPRT 的对照。线虫里与等摩尔葫芦巴碱一起比较寿命。"),
    ("烟酰胺单核苷酸", "NAD+ 前体对照之一。"),
)
ALIASES = (
    ("烟酰胺单核苷酸", "烟酰胺单核苷酸"),
    ("nicotinamide mononucleotide", "烟酰胺单核苷酸"),
    ("烟酰胺核糖", "烟酰胺核糖"),
    ("nicotinamide riboside", "烟酰胺核糖"),
    ("葫芦巴碱", "葫芦巴碱"),
    ("trigonelline", "葫芦巴碱"),
    ("烟酰胺", "烟酰胺"),
    ("nicotinamide", "烟酰胺"),
    ("烟酸", "烟酸"),
    ("niacin", "烟酸"),
)
