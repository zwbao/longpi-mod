"""Higgins et al., Nature Communications 2022. No coefficient vector was published."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Data availability. Expression matrices, not a personal weight table.
GEO_FIG2 = "GSE184395"
GEO_FIG4 = "GSE184513"
GEO_FIG8 = "GSE184394"

# Abstract. SIRT1 deletion reversed these.
SIRT1_REQUIRED = (
    "暗周期产热",
    "肝脏 FGF21",
)
# Abstract, plus hepatic de novo lipogenesis from the discussion paragraph.
SIRT1_DISPENSABLE = (
    "胰岛素敏感",
    "抗血脂异常",
    "明周期产热",
    "肝脏从头合成脂肪",
)

ABSENT = {"无", "缺失", "absent", "no", "false", "敲除"}
PRESENT = {"有", "保留", "present", "yes", "true", "野生"}
