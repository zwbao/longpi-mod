"""Liu et al., Nature Aging 2024, Table 1 n and Table 2 C-statistics. Factor names from the R script."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

ELIGIBLE_N = 5676
PGS = {"cad": "PGS000018", "t2d": "PGS000036", "ad": "PGS000334", "prostate": "PGS000662"}
CASES = {
    "cad": (333, 4760),
    "t2d": (579, 4718),
    "ad": (273, 5074),
    "prostate": (141, 2323),
}
FACTORS = {
    "cad": (
        ("BL_AGE", "年龄"), ("BMI", "体质指数"), ("SYSTM", "收缩压"), ("KOL", "总胆固醇"),
        ("HDL", "高密度脂蛋白"), ("CURR_SMOKE", "现在吸烟"), ("exercise", "锻炼"),
        ("PREVAL_DIAB_GDM", "基线糖尿病"), ("MI_FAMILYHIST", "心梗家族史"),
    ),
    "t2d": (
        ("BL_AGE", "年龄"), ("BMI", "体质指数"), ("SYSTM", "收缩压"), ("KOL", "总胆固醇"),
        ("HDL", "高密度脂蛋白"), ("TRIG", "甘油三酯"), ("CURR_SMOKE", "现在吸烟"),
        ("exercise", "锻炼"), ("DIAB_FAMILYHIST", "糖尿病家族史"),
    ),
    "ad": (
        ("BL_AGE", "年龄"), ("BMI", "体质指数"), ("SYSTM", "收缩压"), ("DIASM", "舒张压"),
        ("KOL", "总胆固醇"), ("HDL", "高密度脂蛋白"), ("ALKI2_FR02", "饮酒"),
        ("CURR_SMOKE", "现在吸烟"), ("exercise", "锻炼"), ("PREVAL_DIAB_T2", "基线二型糖尿病"),
        ("PREVAL_STR_SAH_TIA", "卒中或短暂性脑缺血"), ("PREVAL_MENTAL", "精神疾病史"),
    ),
    "prostate": (
        ("BL_AGE", "年龄"), ("BMI", "体质指数"), ("ALKI2_FR02", "饮酒"),
        ("CURR_SMOKE", "现在吸烟"), ("exercise", "锻炼"), ("CANC_FAMILYHIST", "肿瘤家族史"),
    ),
}
# Table 2 column order: age, age+PRS, age+microbiome, age+PRS+microbiome, CRFs, CRFs+PRS+microbiome
CSTAT = {
    "cad": {
        "age": (0.719, 0.695, 0.743), "age_prs": (0.766, 0.742, 0.789),
        "age_gms": (0.722, 0.698, 0.747), "age_prs_gms": (0.767, 0.744, 0.791),
        "crf": (0.771, 0.748, 0.793), "crf_prs_gms": (0.794, 0.772, 0.817),
    },
    "t2d": {
        "age": (0.625, 0.605, 0.646), "age_prs": (0.675, 0.654, 0.695),
        "age_gms": (0.665, 0.644, 0.685), "age_prs_gms": (0.702, 0.681, 0.722),
        "crf": (0.785, 0.768, 0.802), "crf_prs_gms": (0.799, 0.783, 0.816),
    },
    "ad": {
        "age": (0.880, 0.864, 0.895), "age_prs": (0.898, 0.883, 0.914),
        "age_gms": (0.880, 0.864, 0.895), "age_prs_gms": (0.898, 0.883, 0.914),
        "crf": (0.883, 0.868, 0.899), "crf_prs_gms": (0.900, 0.885, 0.915),
    },
    "prostate": {
        "age": (0.769, 0.739, 0.798), "age_prs": (0.797, 0.766, 0.828),
        "age_gms": (0.774, 0.745, 0.802), "age_prs_gms": (0.801, 0.770, 0.832),
        "crf": (0.773, 0.744, 0.802), "crf_prs_gms": (0.804, 0.774, 0.834),
    },
}
WEIGHTS_PRESENT = False
