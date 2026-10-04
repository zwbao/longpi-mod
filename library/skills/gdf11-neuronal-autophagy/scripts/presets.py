"""Moigneu et al., Nature Aging 2023, doi:10.1038/s43587-022-00352-3.

Human medians are Fig. 6b. Sample sizes are Fig. 6a,c and the methods.
The mouse intraperitoneal dose is experimental and is not a personal instruction.
No decision threshold column is published.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "# 血清生长分化因子与神经元自噬"

FIRST_WAVE_N = 1560
MDD_N = 57
CONTROL_N = 51
EPISODE_N = 103
NO_EPISODE_N = 656
MEDIAN_CONTROL_PG_ML = 22.69
MEDIAN_MDD_PG_ML = 11.66
# Aged-mouse intraperitoneal dose in the results. Not a personal dose.
MOUSE_MG_PER_KG = 1
WEIGHTS_PRESENT = False

MARKER = "血清生长分化因子"
ALIASES = ("gdf11", "gdf-11", "bmp11", "bmp-11", "血清gdf11", "血清生长分化因子")
