"""Published numbers and the personal list. No regression weights are stored here."""

from __future__ import annotations

import csv
from pathlib import Path

BOUNDARY = (
    "边界: 这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)


FULL_TEXT = True
N_EPIGENETIC_CLOCKS = 29
N_CLINICAL_CLOCKS = 4
N_PROTEOMIC_CLOCKS = 2
N_METABOLOMIC_CLOCKS = 3
N_BA_CLOCKS_INVESTIGATED = 26
METHYLDETECTR_R = 0.90
SKIN_BLOOD_R = 0.87
METHYLDETECTRAGE_R = 0.91
GRIMAGE_R = 0.85
KDM_LEVINE_R = 0.76
SKIN_BLOOD_REPLICATE_YEARS = 2.56

CLOCKS = [
    ("multi-tissue", "表观遗传", False),
    ("skin & blood", "表观遗传", False),
    ("phenoage", "表观遗传", False),
    ("grimage2", "表观遗传", True),
    ("grimage", "表观遗传", True),
    ("methyldetectr", "表观遗传", False),
    ("causage", "表观遗传", False),
    ("hannum", "表观遗传", False),
    ("mlr-levine", "临床", False),
    ("pca-levine", "临床", False),
    ("kdm-levine", "临床", True),
    ("kdm", "临床", True),
    ("protage-tanaka", "蛋白组", False),
    ("protage-md", "蛋白组", False),
]

# Not a clock in the paper's table: the phenotypic age from nine blood
# chemistries (the "phenoage" output of accelerated-biological-aging-risk).
# The paper's "phenoage" above is the DNA-methylation PhenoAge.
BLOOD_PHENOAGE = "血检表型年龄"
BLOOD_PHENOAGE_NOTE = "这是九项血检算出的表型年龄，不是表里的甲基化 phenoage。"


def _canonical(name: str) -> str:
    return " ".join(name.casefold().replace("_", " ").split())


def known_clock(name: str) -> bool:
    """True for a clock render_body lists: one in the paper's table, or the blood phenotypic age."""
    canonical = _canonical(name)
    return canonical == BLOOD_PHENOAGE or any(canonical == clock for clock, _, _ in CLOCKS)


def _replicate_note(points):
    timed = []
    for age, time_years in points:
        if time_years is None:
            return ""
        timed.append((time_years, age))
    timed.sort()
    notes = []
    for (t1, a1), (t2, a2) in zip(timed, timed[1:]):
        limit = SKIN_BLOOD_REPLICATE_YEARS + abs(t2 - t1)
        delta = abs(a2 - a1)
        if delta > limit:
            notes.append(
                f"相邻时间点生物年龄绝对差是 {delta:g}，大于技术重复最大绝对差 {SKIN_BLOOD_REPLICATE_YEARS:g} 年加上经过的 {abs(t2 - t1):g} 年。"
            )
        else:
            notes.append(
                f"相邻时间点生物年龄绝对差是 {delta:g}，没有大于技术重复最大绝对差 {SKIN_BLOOD_REPLICATE_YEARS:g} 年加上经过的 {abs(t2 - t1):g} 年。"
            )
    if not notes:
        return ""
    return " " + "".join(notes)


def render_body(rows):
    grouped = {}
    for row in rows:
        clock = _canonical(row.get("clock") or "")
        if not clock:
            continue
        try:
            age = float(row.get("biological_age") or row.get("ba"))
        except ValueError:
            continue
        time_text = row.get("time_years") or ""
        time_years = float(time_text) if time_text != "" else None
        if clock not in grouped:
            grouped[clock] = []
        grouped[clock].append((age, time_years))
    known = {name: (category, includes_ca) for name, category, includes_ca in CLOCKS}
    ranked = [name for name, _, _ in CLOCKS if name in grouped]
    if BLOOD_PHENOAGE in grouped:
        ranked.append(BLOOD_PHENOAGE)
    items = []
    for name in ranked:
        points = grouped[name]
        values = [age for age, _ in points]
        category, includes_ca = known.get(name, ("论文表格以外", False))
        stability = None
        if len(values) < 2:
            detail = "少于两个时间点，不能计算个体稳定度。"
        else:
            diffs = []
            for i in range(len(values)):
                for j in range(i + 1, len(values)):
                    diffs.append(abs(values[i] - values[j]))
            mean_diff = sum(diffs) / len(diffs)
            if mean_diff == 0:
                detail = "各时间点生物年龄相同。倒数没有定义，这里不填一个无限大的数。"
            else:
                stability = 1 / mean_diff
                detail = f"未缩放的个体稳定度是 {stability:.6g}。类别是{category}。"
        if name == "skin & blood" and len(points) >= 2:
            detail += _replicate_note(points)
        if includes_ca:
            detail += "论文写明这类时钟包含实际年龄。"
        if name == BLOOD_PHENOAGE:
            detail += BLOOD_PHENOAGE_NOTE
        items.append({"name": name, "aliases": [name], "detail": detail, "stability": stability})
    if items:
        sentence = "这次用同一时钟各时间点的生物年龄算了未缩放的稳定度。"
    else:
        sentence = "没有提供能对上的时钟生物年龄，这次没有算出稳定度。"
    paragraphs = ["# 时钟稳定度", "", sentence]
    return paragraphs, items


def fixture_rows():
    return [
        {"clock": "PhenoAge", "biological_age": "40"},
        {"clock": "PhenoAge", "biological_age": "42"},
        {"clock": "PhenoAge", "biological_age": "44"},
        {"clock": "GrimAge", "biological_age": "50"},
        {"clock": "NotAPaperClock", "biological_age": "3"},
    ]


def write_fixture(path: Path) -> None:
    path.write_text(
        "clock,biological_age\nPhenoAge,40\nPhenoAge,42\nPhenoAge,44\nGrimAge,50\nNotAPaperClock,3\n",
        encoding="utf-8",
    )


def check_published_numbers():
    assert METHYLDETECTR_R == 0.90
    assert SKIN_BLOOD_R == 0.87
    assert METHYLDETECTRAGE_R == 0.91
    assert GRIMAGE_R == 0.85
    assert KDM_LEVINE_R == 0.76
    assert SKIN_BLOOD_REPLICATE_YEARS == 2.56
    assert N_BA_CLOCKS_INVESTIGATED == 26
    items = {item["name"]: item["detail"] for item in render_body(fixture_rows())[1]}
    assert items["phenoage"].startswith("未缩放的个体稳定度是 0.375")
    assert "少于两个时间点" in items["grimage"]
    assert "包含实际年龄" in items["grimage"]
    skin = render_body(
        [
            {"clock": "Skin & Blood", "biological_age": "40", "time_years": "0"},
            {"clock": "Skin & Blood", "biological_age": "44", "time_years": "1"},
        ]
    )[1][0]["detail"]
    assert "大于技术重复最大绝对差 2.56 年加上经过的 1 年" in skin
