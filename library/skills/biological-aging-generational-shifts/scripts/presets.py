"""Published numbers and the personal list. No regression weights are stored here."""

from __future__ import annotations

import csv
from pathlib import Path

BOUNDARY = (
    "边界: 这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)


FULL_TEXT = True
UKB_N = 154169
AOU_N = 10262
PHENOAGE_SD_INCREASE = 0.23
PHENOAGE_HR = 1.08
PHENOAGE_HR_LOW = 1.03
PHENOAGE_HR_HIGH = 1.13
IMMUNE_LUNG_HR = 1.89
IMMUNE_LUNG_LOW = 1.20
IMMUNE_LUNG_HIGH = 2.97
ADIPOSE_CRC_HR = 1.60
ADIPOSE_CRC_LOW = 1.11
ADIPOSE_CRC_HIGH = 2.32

MEASURES = [
    ("phenoage_gap", "PhenoAge年龄差"),
    ("kdm_age_gap", "KDM年龄差"),
    ("metabolomic_age_gap", "代谢组年龄差"),
    ("immune_aging", "免疫衰老"),
    ("adipose_aging", "脂肪组织衰老"),
]


def _num(row, key):
    text = row.get(key, "")
    if text == "":
        return None
    return float(text)


def render_body(rows):
    row = rows[0] if rows else {}
    age = _num(row, "age")
    birth = _num(row, "birth_year")
    phenoage = _num(row, "phenoage")
    items = []
    if phenoage is not None and age is not None:
        gap = phenoage - age
        items.append(
            {
                "name": "PhenoAge年龄差",
                "aliases": ["PhenoAge年龄差", "phenoage"],
                "detail": f"未标准化差值是 {gap:g}，由你提供的 PhenoAge 减去年龄。论文报告的是标准化年龄差，这里不把它标准化。",
            }
        )
    labels = {
        "kdm_age_gap": ("KDM年龄差", "这是你提供的 KDM 年龄差，本技能不重算。"),
        "metabolomic_age_gap": ("代谢组年龄差", "这是你提供的代谢组年龄差，本技能不重算。"),
        "immune_aging": ("免疫衰老", "这是你提供的免疫衰老测量，不乘以肺癌 HR。"),
        "adipose_aging": ("脂肪组织衰老", "这是你提供的脂肪组织衰老测量，不乘以结直肠癌 HR。"),
    }
    for key, (display, sentence) in labels.items():
        value = _num(row, key)
        if value is None:
            continue
        items.append(
            {
                "name": display,
                "aliases": [display, key],
                "detail": f"数值是 {value:g}。{sentence}",
            }
        )
    if phenoage is not None and age is not None:
        head = "这次用你提供的 PhenoAge 减去年龄"
    elif items:
        head = "这次记下你提供的衰老测量"
    else:
        head = ""
    if birth is not None and 1965 <= birth <= 1974:
        mid = "出生年落在论文对照的后一段"
    elif birth is not None and 1950 <= birth <= 1954:
        mid = "出生年落在论文用来作参照的一段"
    elif birth is not None:
        mid = "出生年不在论文用来对照的两段里"
    else:
        mid = ""
    if head and mid:
        opening = f"{head}，{mid}，没有把队列风险比乘上去。"
    elif head:
        opening = f"{head}，没有把队列风险比乘上去。"
    else:
        opening = "没有提供可对照的衰老测量，这次没有算出年龄差。"
    paragraphs = ["# 衰老测量对照", "", opening]
    return paragraphs, items


def fixture_rows():
    return [
        {
            "age": "48",
            "birth_year": "1970",
            "phenoage": "52",
            "kdm_age_gap": "1.5",
            "metabolomic_age_gap": "",
            "immune_aging": "",
            "adipose_aging": "0.2",
        }
    ]


def write_fixture(path: Path) -> None:
    path.write_text(
        "age,birth_year,phenoage,kdm_age_gap,metabolomic_age_gap,immune_aging,adipose_aging\n"
        "48,1970,52,1.5,,,0.2\n",
        encoding="utf-8",
    )


def check_published_numbers():
    assert UKB_N == 154169
    assert PHENOAGE_HR == 1.08
    assert IMMUNE_LUNG_HR == 1.89
    assert ADIPOSE_CRC_HR == 1.60
    names = [item["name"] for item in render_body(fixture_rows())[1]]
    assert names == ["PhenoAge年龄差", "KDM年龄差", "脂肪组织衰老"]
    detail = render_body(fixture_rows())[1][0]["detail"]
    assert "4" in detail
