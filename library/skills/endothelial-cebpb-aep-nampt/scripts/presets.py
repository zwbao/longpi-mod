"""Li et al., Science Advances 2026. No personal coefficient vector was published."""

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
    "队列或小鼠实验里的药效与寿命差异不是你的个人疗效。"
)

ARRAYEXPRESS = "E-MTAB-17006"

# Abstract / results. Pathway nodes claimed in endothelium.
PATHWAY_NODES = (
    "内皮 C/EBPβ 随年龄升高",
    "内皮 AEP（腿脉酶/δ-分泌酶）随年龄升高",
    "AEP 在 N136 切割 NAMPT",
    "系统性 NAD+ 耗竭与内皮衰老",
    "中枢与外周血管功能障碍，并牵动全身衰老表型",
)

# Abstract. Endothelial-specific overexpression accelerated aging in mice.
MOUSE_ACCELERATORS = (
    "内皮特异 C/EBPβ 过表达（Tie2-C/EBPβ）",
    "内皮特异 AEP 过表达（Tie2-AEP）",
)

# Abstract. Genetic rescues in Tie2-C/EBPβ mice.
MOUSE_GENETIC_RESCUES = (
    "AEP 遗传缺失",
    "AEP 抗性 NAMPT N136A",
)

# Abstract. Pharmacological findings in mice — listed as paper claims only.
MOUSE_PHARM_FINDINGS = (
    "AEP 抑制剂 CP#11A（正文写在该模型里优于单独 NMN）",
    "烟酰胺单核苷酸 NMN 补充（正文写可缓解年龄相关血管下降）",
)

ABSENT = {"无", "缺失", "absent", "no", "false", "低", "降低"}
PRESENT = {"有", "保留", "present", "yes", "true", "高", "升高"}

MARKER_KEYS = {
    "endothelial_cebpb": ("endothelial_cebpb", "内皮CEBPβ", "内皮C/EBPβ", "cebpb"),
    "endothelial_aep": ("endothelial_aep", "内皮AEP", "aep", "legumain"),
    "nampt_cleavage": ("nampt_cleavage", "NAMPT切割", "nampt_c137", "nampt切割"),
    "nad_level": ("nad_level", "NAD", "NAD+", "nad"),
}
