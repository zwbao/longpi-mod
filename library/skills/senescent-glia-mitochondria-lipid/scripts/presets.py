"""Byrns et al., Nature 2024, doi:10.1038/s41586-024-07516-8.

Named markers are the ones printed on Figure 1. No expression weights.
"""

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

TITLE = "衰老胶质与脂质堆积"
DOI = "10.1038/s41586-024-07516-8"
FULL_TEXT_READ = True

# Lipidomics cell count per replicate. Not printed in the personal report.
LIPID_CELLS = 100000

VIAL_CM = 8
LIPID_FDR = "0.10"

MARKERS = {
    "lam": "lamin B（Lam）",
    "lamin b": "lamin B（Lam）",
    "dap": "p21（dap）",
    "p21": "p21（dap）",
    "p53": "p53",
    "sting": "Sting",
    "ctsb": "CtsB",
    "egfr": "Egfr",
    "mmp1": "Mmp1",
    "mmp2": "Mmp2",
    "pvf1": "Pvf1",
    "timp": "Timp",
    "dfos": "dFos",
    "fos": "dFos",
    "djun": "dJun",
    "jun": "dJun",
}
