"""Fig. 2 training taus and the conversion-model AUCs.

doi:10.1038/s41746-026-02597-3. The CVAE repository clone contained no files.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

BABRI_N = 918
BABRI_NC = 459
BABRI_MCI = 459
ADNI_N = 1293
ADNI1_N = 591
ADNI23_N = 702
AUC_MCI_SPECIFIC = 0.83
AUC_WHOLE_BRAIN = 0.74
AUC_NONSPECIFIC = 0.65
AUC_CSF = 0.77
AUC_WHOLE_BRAIN_T = 29.29
ACCURACY_CSF_PADJ = 0.381

DOMAINS = (
    ("注意", "MCI 特异 tau = 0.037，共享 tau = -0.006，差值 0.043。Fig. 2 训练集。"),
    ("情景记忆", "MCI 特异 tau = 0.022，共享 tau = -0.004，差值 0.026。Fig. 2 训练集。"),
    ("执行功能", "MCI 特异 tau = 0.003，共享 tau = -0.001，差值 0.004。Fig. 2 训练集。"),
)
