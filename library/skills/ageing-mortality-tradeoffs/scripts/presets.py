"""Locus class labels from Table 2 and Soma names from the supplement. No mortality weights.

doi:10.1038/s41586-026-10407-9. Table 2, column "Type and age of main effects".
Footnote: durable means effects to at least T770; RAM means gradual reduction to at least T800;
reversal means effect reversals; early is at most T500; mid is T500 to T845; late is at least T860.
Soma names are the locus column of supplementary Table 4 in MOESM4.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "寿命位点类型"

# Results: base population. Stays out of the report.
COHORT_N = 6438

# Table 2 type-and-age column, written in Chinese without the day cutoffs.
VITA = {
    "vita1a": "持续，晚期反转（雄性和雌性）",
    "vita1b": "持续，晚期反转（雄性和雌性）",
    "vita1c": "早期（雄性）",
    "vita1d": "早期（雄性）",
    "vita2a": "早期并反转（雄性），效应逐渐变小（雌性）",
    "vita2b": "反转（雄性），效应逐渐变小（雌性）",
    "vita2c": "反转（雄性），效应逐渐变小（雌性）",
    "vita3a": "早期、效应逐渐变小并反转（雄性），持续（雌性）",
    "vita4a": "中期并反转（雄性），持续（雌性）",
    "vita4b": "中期（雄性）",
    "vita5a": "晚期（雄性）",
    "vita6a": "早期和中期（雄性）",
    "vita6b": "早期、中期，效应逐渐变小（雄性）",
    "vita9a": "早期（雄性）；早期、中期、效应逐渐变小并反转（雌性）",
    "vita9b": "早期、反转和晚期（雄性），晚期（雌性）",
    "vita9c": "早期、反转和晚期（雄性），晚期（雌性）",
    "vita10a": "晚期（雄性）",
    "vita11a": "中期反转（雄性）",
    "vita11b": "持续，晚期反转（雌性）",
    "vita11c": "效应逐渐变小（雄性）",
    "vita12a": "持续（雄性和雌性）",
    "vita13a": "效应逐渐变小（雄性），中期（雌性）",
    "vita14a": "早期（雄性），效应逐渐变小（雌性）",
    "vita14b": "效应逐渐变小（雄性和雌性）",
    "vita15a": "早期、中期，效应逐渐变小（雄性），持续（雌性和两性合并）",
    "vita15b": "早期、中期和晚期（雄性）",
    "vita17a": "效应逐渐变小（雄性）",
    "vita18a": "早期（雄性），效应逐渐变小（雌性）",
    "vitaxa": "效应逐渐变小（雄性）",
}

# Supplementary Table 4 locus column in 41586_2026_10407_MOESM4_ESM.xlsx.
SOMA = {
    "soma1a",
    "soma1b",
    "soma2a",
    "soma2b",
    "soma2c",
    "soma3a",
    "soma3b",
    "soma4a",
    "soma4b",
    "soma6a",
    "soma6b",
    "soma7a",
    "soma7b",
    "soma8a",
    "soma8b",
    "soma9a",
    "soma10a",
    "soma11a",
    "soma12a",
    "soma12b",
    "soma13a",
    "soma13b",
    "soma14a",
    "soma14b",
    "soma15a",
    "soma16a",
    "soma17a",
    "soma18a",
    "soma19a",
    "soma19b",
}

MISSING = (
    "不能算死亡概率。补充表 41586_2026_10407_MOESM3_ESM.xlsx 和 MOESM4 有 LOD、性别效应和效应类型，"
    "没有把一只小鼠的基因型写成死亡概率的截距列。"
)


def locus_ids(measurements: dict[str, str]) -> list[str]:
    found = []
    for key, value in measurements.items():
        for text in (key, value):
            token = text.strip().lower().replace(" ", "")
            if token in VITA or token in SOMA:
                found.append(token)
    seen = []
    for token in found:
        if token not in seen:
            seen.append(token)
    return seen


def build(measurements: dict[str, str], age: float | None) -> tuple[str, list[str]]:
    del age
    names = locus_ids(measurements)
    items = ["能算的：", ""]
    if not names:
        items.append("没有对上表二或补充表四里的位点名。")
        lead = "这次没有对上已发表的位点名。"
    else:
        for token in names:
            label = "VitaXa" if token == "vitaxa" else token[0].upper() + token[1:]
            if token in VITA:
                items.append(f"- {label}：表二的效应类型是{VITA[token]}。")
            else:
                items.append(f"- {label}：这是补充表四里的 Soma 位点。")
        lead = "这次只标出位点在论文里的类型。"
    items.extend(["", "不能算的：", "", MISSING])
    return lead, items
