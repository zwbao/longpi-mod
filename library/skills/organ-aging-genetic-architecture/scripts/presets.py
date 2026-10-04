BOUNDARY = '这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。'
UKB_N = 51936
PROTEINS = 2923
ORGAN_ENRICHED = 1799
HEALTHY_N = 7217
LOCI = 119
SHARED_LOCI = 27
RISK_GENES = 554
PAD_R_BEFORE = (-0.90, -0.48)
PAD_R_AFTER = (-0.021, 0.025)
ORGANS = (
    "adipose", "artery", "brain", "heart", "immune", "intestine", "kidney",
    "liver", "lung", "muscle", "pancreas", "skin", "stomach",
)
DISPLAY = {
    "adipose": "脂肪", "artery": "动脉", "brain": "脑", "heart": "心脏",
    "immune": "免疫", "intestine": "肠", "kidney": "肾", "liver": "肝",
    "lung": "肺", "muscle": "肌肉", "pancreas": "胰腺", "skin": "皮肤", "stomach": "胃",
}
ALIASES = {
    "脂肪": "adipose", "adipose": "adipose",
    "动脉": "artery", "artery": "artery",
    "脑": "brain", "brain": "brain",
    "心脏": "heart", "heart": "heart",
    "免疫": "immune", "immune": "immune",
    "肠": "intestine", "intestine": "intestine",
    "肾": "kidney", "肾脏": "kidney", "kidney": "kidney",
    "肝": "liver", "肝脏": "liver", "liver": "liver",
    "肺": "lung", "lung": "lung",
    "肌肉": "muscle", "muscle": "muscle",
    "胰腺": "pancreas", "pancreas": "pancreas",
    "皮肤": "skin", "skin": "skin",
    "胃": "stomach", "stomach": "stomach",
}
MR = {
    "heart": "摘要写明加速的心脏衰老增加心力衰竭风险。",
    "muscle": "摘要写明加速的肌肉衰老增加心力衰竭风险。",
    "kidney": "摘要写明肾脏衰老与高血压有关。",
}
SMOKING_ORGANS = ("lung", "intestine", "kidney", "stomach")
