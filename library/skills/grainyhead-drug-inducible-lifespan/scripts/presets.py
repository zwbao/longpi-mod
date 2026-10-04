"""Grigolon et al., Nature Communications 2022. Lifespan percents from Fig. 2. No screen-wide weights."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

LIBRARY_N = 2560
REPORTER_FOLD = 2
REPORTER_UM = 10
PLATE_UM = 1
OEX_LIFESPAN = 16.3
COMPOUNDS = (
    {"display": "vorinostat 伏立诺他", "lifespan_percent": 12.3, "p_text": "P < 0.001", "aliases": ("伏立诺他", "vorinostat")},
    {"display": "papaverine 罂粟碱", "lifespan_percent": 11.4, "p_text": "P = 0.004", "aliases": ("罂粟碱", "papaverine")},
    {"display": "piperlongumine 荜茇酰胺", "lifespan_percent": 10.7, "p_text": "P = 0.021", "aliases": ("piperlongumine", "piplartine", "荜茇酰胺", "蓡荼酰胺")},
)
WEIGHTS_PRESENT = False
