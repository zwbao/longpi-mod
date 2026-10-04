BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Methods. Seven organs. Brain gray and white matter are separate clocks, not an eighth organ.
ORGANS = ("brain", "heart", "body", "kidney", "liver", "pancreas", "eye")
ORGAN_LABELS = {
    "brain": "脑",
    "heart": "心脏",
    "body": "体成分",
    "kidney": "肾",
    "liver": "肝",
    "pancreas": "胰腺",
    "eye": "眼",
    "brain_gm": "脑灰质",
    "brain_wm": "脑白质",
}
# Results next to each association. These SDs are outcome-specific and are not used as a personal z score.
# Brain GM dementia: HR 1.81, SD 5.46 years. Brain WM cerebrovascular: HR 1.46, SD 6.67 years.
GM_DEMENTIA_HR = 1.81
GM_DEMENTIA_SD_YEARS = 5.46
WM_CEREBRO_HR = 1.46
WM_CEREBRO_SD_YEARS = 6.67
N_IDPS = 1777
N_HEALTHY = 11000
# Results. Proteins named in the main text. ADH4 has no organ in that paragraph.
PROTEINS = (
    ("CHRDL2", "脑"),
    ("ITIH4", "脑"),
    ("LRRC37A2", "脑"),
    ("SEMA3F", "脑"),
    ("TIE1", "脑"),
    ("ABO", "胰腺"),
    ("CLPS", "胰腺"),
    ("GRP", "胰腺"),
    ("ERI1", "眼"),
    ("MSRA", "眼"),
    ("SPINK8", "眼"),
    ("LAMB1", "肾"),
    ("UMOD", "肾"),
    ("ADH4", "正文没有写器官"),
)


def age_gap(predicted: float, chronological: float) -> float:
    return predicted - chronological
