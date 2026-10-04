"""Numbers read from Pickhardt et al., Nat Commun 2025, doi:10.1038/s41467-025-56741-w.

Table 1 IPA drops and Table 2 medians. Cox spline weights and nomogram
points are not numeric in the PDF, so they are not stored here.
"""

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

COHORT_N = 123281
MEAN_AGE = 53.6
WOMEN_N = 58308
DEATHS_N = 26554
CTBA_IPA = 29.2
DEMOGRAPHIC_IPA = 21.7
AUC_10Y = 0.880
HR_Q4_VS_Q1 = 8.73
HR_Q4_VS_Q1_CI = (8.14, 9.36)
EXTERNAL_N = 40718
EXTERNAL_IPA = 28.6
EXTERNAL_HR_Q4_VS_Q1 = 5.14

# Table 1. IPA drop; biomarkers with drop < 0.1 were excluded.
IPA_DROP = {
    "muscle_density": 5.1,
    "aortic_calcium": 2.0,
    "visceral_fat_density": 1.5,
    "bone_density": 1.1,
    "vsr": 0.4,
    "kidney_volume": 0.3,
    "sat_area": 0.2,
    "muscle_area": 0.1,
}

DISPLAY = {
    "muscle_density": "骨骼肌密度",
    "aortic_calcium": "腹主动脉钙化积分",
    "visceral_fat_density": "内脏脂肪密度",
    "bone_density": "L1 骨小梁密度",
    "vsr": "内脏脂肪与皮下脂肪比值",
    "kidney_volume": "肾脏体积",
    "sat_area": "皮下脂肪面积",
    "muscle_area": "骨骼肌面积",
}

UNIT = {
    "muscle_density": "HU",
    "aortic_calcium": "Agatston",
    "visceral_fat_density": "HU",
    "bone_density": "HU",
    "vsr": "",
    "kidney_volume": "mL",
    "sat_area": "cm2",
    "muscle_area": "cm2",
}

# Table 2 medians: sex -> age band -> biomarker -> (alive, dead).
# Age bands are chronological age, not CT biological age.
TABLE2 = {
    "male": {
        "18-39": {
            "muscle_density": (48, 44),
            "aortic_calcium": (0, 0),
            "visceral_fat_density": (-90, -89),
            "bone_density": (167, 166),
            "vsr": (0.63, 0.70),
            "kidney_volume": (424, 419),
            "sat_area": (150, 155),
            "muscle_area": (181, 182),
        },
        "40-59": {
            "muscle_density": (40, 34),
            "aortic_calcium": (0, 65),
            "visceral_fat_density": (-95, -90),
            "bone_density": (144, 138),
            "vsr": (1.02, 1.02),
            "kidney_volume": (445, 442),
            "sat_area": (179, 176),
            "muscle_area": (188, 180),
        },
        "60-79": {
            "muscle_density": (31, 26),
            "aortic_calcium": (275, 942),
            "visceral_fat_density": (-95, -93),
            "bone_density": (123, 116),
            "vsr": (1.27, 1.32),
            "kidney_volume": (444, 433),
            "sat_area": (182, 182),
            "muscle_area": (180, 177),
        },
        "80+": {
            "muscle_density": (21, 19),
            "aortic_calcium": (2057, 2645),
            "visceral_fat_density": (-93, -91),
            "bone_density": (103, 98),
            "vsr": (1.48, 1.45),
            "kidney_volume": (398, 384),
            "sat_area": (166, 153),
            "muscle_area": (163, 158),
        },
    },
    "female": {
        "18-39": {
            "muscle_density": (44, 38),
            "aortic_calcium": (0, 0),
            "visceral_fat_density": (-86, -85),
            "bone_density": (181, 171),
            "vsr": (0.24, 0.31),
            "kidney_volume": (352, 346),
            "sat_area": (219, 213),
            "muscle_area": (127, 125),
        },
        "40-59": {
            "muscle_density": (34, 28),
            "aortic_calcium": (0, 12),
            "visceral_fat_density": (-91, -89),
            "bone_density": (155, 144),
            "vsr": (0.38, 0.48),
            "kidney_volume": (346, 349),
            "sat_area": (246, 234),
            "muscle_area": (130, 132),
        },
        "60-79": {
            "muscle_density": (23, 17),
            "aortic_calcium": (100, 757),
            "visceral_fat_density": (-92, -91),
            "bone_density": (122, 116),
            "vsr": (0.50, 0.60),
            "kidney_volume": (324, 313),
            "sat_area": (245, 226),
            "muscle_area": (124, 123),
        },
        "80+": {
            "muscle_density": (11, 9),
            "aortic_calcium": (1914, 2614),
            "visceral_fat_density": (-90, -88),
            "bone_density": (99, 93),
            "vsr": (0.60, 0.62),
            "kidney_volume": (294, 271),
            "sat_area": (205, 193),
            "muscle_area": (116, 116),
        },
    },
}
