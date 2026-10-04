"""Li et al., Nature Communications 2023. Index definition from Fig. 1. AUCs from Fig. 3c and 3d."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

R2_GT = 0.80
MAE_LOW = 4.25
MAE_HIGH = 4.82
N_DIFFUSE = 525
N_SLIT = 430
N_PHONE = 50
AUC_DIFFUSE = 0.621
AUC_DIFFUSE_AGE = 0.523
AUC_SLIT = 0.600
AUC_SLIT_AGE = 0.509
N_AUC_DIFFUSE = 1555
N_AUC_SLIT = 1536
# Fast-ager cutoffs printed for the index, in years.
FAST_YEARS = (5, 10, 20)
WEIGHTS_PRESENT = False
