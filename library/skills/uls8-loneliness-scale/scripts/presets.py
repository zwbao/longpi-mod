"""Scoring rules of the ULS-8 short-form UCLA Loneliness Scale.

Source [P]: Hays RD, DiMatteo MR. A short-form measure of loneliness.
J Pers Assess 1987;51(1):69-81, doi:10.1207/s15327752jpa5101_6
(subscription; the full text was not opened). The abstract says the eight
items were taken from the Revised UCLA Loneliness Scale (ULS-20).

The item scoring is quoted from an open-access description of the same scale,
Xu S et al. Medicine 2018;97(38):e12373, doi:10.1097/MD.0000000000012373
(CC BY 4.0), section 2.3.1:

    "The ULS-8 Loneliness Scale [25] contains 8 items, including 2 positively
    worded items (Item 3 ... and Item 6 ...), which are reverse-scored. Each
    item has a 4-level frequency score, with answer choices of 1 (never),
    2 (rarely), 3 (sometimes), and 4 (always). The total score ranges from 8 to
    32 points, with higher scores suggesting a higher degree of loneliness."

Reference [25] there is Hays and DiMatteo 1987. No published cut-points were
found (see references/contract.md), so the report gives the score only.

The item wording belongs to the Revised UCLA Loneliness Scale and is not
reproduced here. Each item is described by its number and topic.
"""

from __future__ import annotations

TITLE = "ULS-8 孤独感量表"

# (skill.json key, item number, topic in plain Chinese, reverse-scored)
ITEMS = (
    ("uls8_item1", 1, "缺少陪伴", False),
    ("uls8_item2", 2, "有没有可以求助的人", False),
    ("uls8_item3", 3, "自己是不是外向的人", True),
    ("uls8_item4", 4, "觉得被冷落、被排除在外", False),
    ("uls8_item5", 5, "觉得和别人隔绝", False),
    ("uls8_item6", 6, "想要陪伴时能不能找到", True),
    ("uls8_item7", 7, "因为自己退缩、孤僻而不开心", False),
    ("uls8_item8", 8, "身边有人，却觉得他们并不和自己在一起", False),
)
KEYS = tuple(key for key, _n, _t, _r in ITEMS)
REVERSED = tuple(key for key, _n, _t, rev in ITEMS if rev)

# Each answer is 1 (never) to 4; a reverse-scored item counts 5 - answer.
ANSWER_MIN, ANSWER_MAX = 1, 4
REVERSE_BASE = ANSWER_MIN + ANSWER_MAX
TOTAL_MIN, TOTAL_MAX = 8, 32

# Answer words read as the published 1-4 codes. Xu 2018 prints the fourth
# anchor as "always"; Chinese forms print 经常 or 总是. Both read as 4.
ANSWER_WORDS = {
    "从不": 1, "从来没有": 1, "never": 1,
    "很少": 2, "偶尔": 2, "rarely": 2,
    "有时": 3, "有时候": 3, "sometimes": 3,
    "经常": 4, "总是": 4, "often": 4, "always": 4,
}
FREQUENT = 3  # "sometimes" or more often, on the answer as marked

HOTLINE = (
    "如果你最近常常感到非常难受、没有希望，或者有伤害自己的念头，请不要一个人扛："
    "心理危机热线可以打 12356，希望24热线是 400-161-9995；有立即的危险就拨打 120 或 110。"
)

BOUNDARY = (
    "ULS-8 是自评量表，分数说明你最近感到孤独的程度，不是诊断，也不能代替心理或精神科评估。"
    "没有找到公认的分档切点，报告只给分数。"
)


def item_score(key: str, answer: int) -> int:
    """Score of one item: the answer as marked, reversed for items 3 and 6."""
    return REVERSE_BASE - answer if key in REVERSED else answer


def total(answers: dict) -> int:
    """ULS-8 total (8-32) from the eight answers as marked (1-4)."""
    return sum(item_score(key, int(answers[key])) for key in KEYS)
