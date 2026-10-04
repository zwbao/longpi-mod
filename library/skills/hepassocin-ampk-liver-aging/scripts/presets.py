"""Yang et al., STTT 2026. No personal coefficient vector was published."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。队列或小鼠里的药效差异不是你的个人疗效。"

PATHWAY_NODES = (
    "老龄时循环与肝内 HPS 下降（小鼠与人观察）",
    "HPS 经 ANXA2-ERK-p90RSK-LKB1 激活肝细胞 AMPK",
    "维持自噬、对抗肝细胞衰老与脂肪变",
    "支持部分肝切除后的再生",
)

MOUSE_FINDINGS = (
    "老龄 HPS-KO：肝衰老加重、自噬受损、PHx 后再生失败与死亡升高",
    "AICAR（AMPK 激动）改善老龄 HPS-KO 表型与再生",
    "外源 HPS 改善老龄野生型小鼠再生结局",
)

ABSENT = {"无", "缺失", "absent", "no", "false", "低", "降低"}
PRESENT = {"有", "保留", "present", "yes", "true", "高", "升高"}
MARKER_KEYS = {
    "hps_level": ("hps_level", "HPS", "hepassocin", "FGL1"),
    "ampk_activation": ("ampk_activation", "AMPK", "pAMPK"),
}
