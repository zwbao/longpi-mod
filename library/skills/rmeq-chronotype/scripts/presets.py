"""Scoring rules and chronotype categories of the reduced Morningness-Eveningness Questionnaire (rMEQ).

Source [P]: Adan A, Almirall H. Horne & Östberg morningness-eveningness
questionnaire: a reduced scale. Personality and Individual Differences
1991;12(3):241-253, doi:10.1016/0191-8869(91)90110-w (subscription; the full
text was not opened). The rMEQ keeps items 1, 7, 10, 18 and 19 of the 19-item
MEQ (Horne & Östberg 1976).

Printed numbers used here, each quoted in references/contract.md:

- Total 4-25 and the five categories, attributed to Adan & Almirall 1991 in
  Belfry et al. Front Psychiatry 2020 (doi:10.3389/fpsyt.2020.550597, CC BY)
  and Gooderick et al. Eur J Sport Sci 2025 (doi:10.1002/ejsc.12247, CC BY):
  4-7 definitely evening, 8-11 moderately evening, 12-17 neither,
  18-21 moderately morning, 22-25 definitely morning.
- Option scores of the five items: Hwang et al. J Korean Med Sci 2024
  (doi:10.3346/jkms.2024.39.e257, CC BY-NC), Table 1: items 1, 3 and 4 have
  five options scored 5 to 1; item 2 has four options scored 1 to 4; item 5
  scores 6, 4 and 2 for its first three options. Danielsson et al. Chronobiol
  Int 2019 (doi:10.1080/07420528.2018.1564322, CC BY-NC-ND) prints "question 5
  was scored 0-6". The fourth option of item 5 is therefore 0; with it the
  item scores add up to exactly the published 4-25.

The item wording is copyrighted (MEQ © 1976 Gordon and Breach) and is not
reproduced here. Each item is described by number and topic.
"""

from __future__ import annotations

TITLE = "rMEQ 晨型夜型问卷"

# (skill.json key, rMEQ item, MEQ item, topic in plain Chinese, allowed scores)
ITEMS = (
    ("rmeq_item1", 1, 1, "完全自由安排时，几点起床", (1, 2, 3, 4, 5)),
    ("rmeq_item2", 2, 7, "早上醒来后半小时内有多累", (1, 2, 3, 4)),
    ("rmeq_item3", 3, 10, "晚上几点开始觉得累、想睡", (1, 2, 3, 4, 5)),
    ("rmeq_item4", 4, 18, "一天里几点状态最好", (1, 2, 3, 4, 5)),
    ("rmeq_item5", 5, 19, "觉得自己是晨型还是夜型", (0, 2, 4, 6)),
)
KEYS = tuple(key for key, _n, _meq, _t, _allowed in ITEMS)
ALLOWED = {key: allowed for key, _n, _meq, _t, allowed in ITEMS}
TOTAL_MIN, TOTAL_MAX = 4, 25

# (low, high, label, English label as printed). Adan & Almirall 1991.
CATEGORIES = (
    (4, 7, "明确夜型", "definitely evening type"),
    (8, 11, "中度夜型", "moderately evening type"),
    (12, 17, "中间型", "neither type"),
    (18, 21, "中度晨型", "moderately morning type"),
    (22, 25, "明确晨型", "definitely morning type"),
)

BOUNDARY = (
    "rMEQ 衡量的是你偏好的作息时段（晨型还是夜型），不是睡眠质量，也不诊断睡眠障碍。"
    "晨型、夜型本身都不是病。"
)


def total(answers: dict) -> int:
    """rMEQ total: the five item scores added up (4-25)."""
    return sum(int(answers[key]) for key in KEYS)


def category(score: int) -> tuple[str, int, int]:
    """(label, low, high) of the published chronotype category holding the score."""
    for low, high, label, _en in CATEGORIES:
        if low <= score <= high:
            return label, low, high
    raise ValueError(f"rMEQ score {score} is outside {TOTAL_MIN}-{TOTAL_MAX}")
