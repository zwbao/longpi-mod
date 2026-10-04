"""Scoring rules and severity bands of the IIEF-5 (Sexual Health Inventory for Men).

Source [P]: Rosen RC, Cappelleri JC, Smith MD, Lipsky J, Peña BM. Development
and evaluation of an abridged, 5-item version of the International Index of
Erectile Function (IIEF-5) as a diagnostic tool for erectile dysfunction.
Int J Impot Res 1999;11(6):319-326, doi:10.1038/sj.ijir.3900472
(subscription; the full text was not opened). The abstract prints:

    "a cutoff score of 21 (range of scores, 5-25) discriminated best
    (sensitivity=0.98, specificity=0.88). ED was classified into five severity
    levels, ranging from none (22-25) through severe (5-7)."

The three middle bands are quoted from the abstract of Rhoden EL et al.
Int J Impot Res 2002;14:245-250, doi:10.1038/sj.ijir.3900859, which applies
the same classification:

    "The possible scores for the IIEF-5 range from 5 to 25, and ED was
    classified into five categories based on the scores: severe (5-7),
    moderate (8-11), mild to moderate (12-16), mild (17-21), and no ED (22-25)."

The recall period ("Over the past 6 months") and the 1-5 option scores are
printed with the questionnaire in de Donato et al. Front Cardiovasc Med 2022,
doi:10.3389/fcvm.2022.847519 (CC BY 4.0), Table 1. Items 3-5 ask about
intercourse; a score range of 5-25 means every item is answered 1-5, so the
bands apply to men who attempted intercourse in the past 6 months.

The item wording is copyrighted (Pfizer) and distributed by Mapi Research
Trust; it is not reproduced here. Each item is described by number and topic.
"""

from __future__ import annotations

TITLE = "IIEF-5 勃起功能问卷"

# (skill.json key, item number, topic in plain Chinese)
ITEMS = (
    ("iief5_item1", 1, "对能勃起并维持勃起的信心"),
    ("iief5_item2", 2, "受到性刺激时，勃起硬度够不够插入"),
    ("iief5_item3", 3, "插入以后能不能维持勃起"),
    ("iief5_item4", 4, "维持勃起直到性交结束有多难"),
    ("iief5_item5", 5, "尝试性交时，自己满意的次数"),
)
KEYS = tuple(key for key, _n, _t in ITEMS)

ANSWER_MIN, ANSWER_MAX = 1, 5
TOTAL_MIN, TOTAL_MAX = 5, 25
RECALL = "过去 6 个月"
CUTOFF = 21  # Rosen 1999: 21 or less discriminated ED from no ED

# (low, high, label, plain meaning). Rosen 1999 / Rhoden 2002, as printed.
BANDS = (
    (22, 25, "无勃起功能障碍", "none"),
    (17, 21, "轻度", "mild"),
    (12, 16, "轻到中度", "mild to moderate"),
    (8, 11, "中度", "moderate"),
    (5, 7, "重度", "severe"),
)

# China-PAR (skills/china-par-ascvd-risk) was derived in adults aged 35-74.
CHINA_PAR_AGES = (35, 74)

BOUNDARY = (
    "IIEF-5 是自评问卷，分档只提示可能有没有勃起功能障碍、大概多重，不是诊断，也不决定治疗。"
    "它只适用于过去 6 个月尝试过性交的男性。是否用药、用什么药，由医生决定。"
)


def total(answers: dict) -> int:
    """IIEF-5 total: the five item scores added up (5-25)."""
    return sum(int(answers[key]) for key in KEYS)


def band(score: int) -> tuple[str, int, int]:
    """(label, low, high) of the published severity band holding the score."""
    for low, high, label, _en in BANDS:
        if low <= score <= high:
            return label, low, high
    raise ValueError(f"IIEF-5 score {score} is outside {TOTAL_MIN}-{TOTAL_MAX}")
