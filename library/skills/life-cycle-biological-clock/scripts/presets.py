"""Published numbers and the personal list. No regression weights are stored here."""

from __future__ import annotations

import csv
from pathlib import Path

BOUNDARY = (
    "边界: 这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)


FULL_TEXT = True
VISITS = 24633025
PEOPLE = 9680764
INDICATORS = 184
UKB_MAE = 4.14
LOWESS_BANDWIDTH = "2/3"
AGE_SPLIT = 18
AVERAGE_WITHIN_SD = 1
OVERAGED_ABOVE_SD = 3
DIABETES_AUC = 0.98
CAD_AUC = 0.98

PEDIATRIC = [
    ("谷草转氨酶", ["ast", "谷草转氨酶", "天冬氨酸氨基转移酶", "aspartate aminotransferase"], "图 2 文字写儿童时钟的主要方向是低 AST"),
    ("肌酐", ["crea", "creatinine", "肌酐"], "图 2 文字写儿童时钟的主要方向是高肌酐"),
    ("总蛋白", ["tp", "total protein", "总蛋白"], "图 2 文字写儿童时钟的主要方向是高总蛋白"),
]
ADULT = [
    ("尿素", ["urea", "尿素", "血尿素"], "图 2 文字写成人时钟最有影响的方向是高尿素"),
    ("白蛋白", ["alb", "albumin", "白蛋白"], "图 2 文字写成人时钟最有影响的方向是低白蛋白"),
    ("红细胞分布宽度", ["rdw", "红细胞分布宽度", "red cell distribution width"], "图 2 文字写成人时钟最有影响的方向是高红细胞分布宽度"),
]


def _match(rows, aliases):
    wanted = {alias.casefold() for alias in aliases}
    for row in rows:
        key = (row.get("indicator") or row.get("name") or row.get("项目") or "").casefold()
        if key in wanted:
            return row.get("value") or row.get("结果") or ""
    return None


def _age_difference(rows):
    for row in rows:
        key = (row.get("indicator") or row.get("name") or row.get("项目") or "").casefold()
        if key in {"standardized_age_difference", "年龄差", "age_difference"}:
            text = row.get("value") or row.get("结果") or ""
            if text == "":
                return None
            return float(text)
    return None


def _adult_band(diff):
    if abs(diff) <= AVERAGE_WITHIN_SD:
        return (
            "平均偏离",
            f"标准化年龄差是 {diff:g}，绝对值没有超过 {AVERAGE_WITHIN_SD:g} 个标准差。正文把成人的这一档称为平均年龄。",
        )
    if diff > OVERAGED_ABOVE_SD:
        return (
            "过度偏离",
            f"标准化年龄差是 {diff:g}，高于 {OVERAGED_ABOVE_SD:g} 个标准差。正文把成人的这一档称为过度偏离。",
        )
    return (
        "年龄差",
        f"标准化年龄差是 {diff:g}。正文只给成人点了两档：绝对值不超过 {AVERAGE_WITHIN_SD:g} 个标准差，以及高于 {OVERAGED_ABOVE_SD:g} 个标准差。这次不归进这两档。",
    )


def render_body(rows):
    age = None
    for row in rows:
        key = (row.get("indicator") or row.get("name") or row.get("项目") or "").casefold()
        if key in {"age", "年龄"}:
            age = float(row.get("value") or row.get("结果"))
    diff = _age_difference(rows)
    title = "# 临床时钟对照"
    if age is None:
        return [title, "", "没有年龄，这次没有选出儿童或成人时钟。"], []
    if age == AGE_SPLIT:
        return [title, "", "年龄正好落在两个时钟的分界上，这次没有选时钟。"], []
    items = []
    if age < AGE_SPLIT:
        chosen = PEDIATRIC
        sentence = "这次按年龄对照儿童时钟里点过名的检验，没有计算生物年龄。"
    else:
        chosen = ADULT
        sentence = "这次按年龄对照成人时钟里点过名的检验，没有计算生物年龄。"
        if diff is not None:
            name, detail = _adult_band(diff)
            items.append({"name": name, "aliases": [name, "年龄差"], "detail": detail})
            sentence = "这次把你提供的标准化年龄差分到成人时钟的档里，并对照点过名的检验，没有从检验值计算生物年龄。"
    paragraphs = [title, "", sentence]
    for display, aliases, direction in chosen:
        value = _match(rows, aliases)
        if value is None:
            continue
        items.append(
            {
                "name": display,
                "aliases": [display, *aliases],
                "detail": f"你这次的数值是 {value}。{direction}。这里没有权重，也不判断这次偏高或偏低。",
            }
        )
    if not items:
        paragraphs = [title, "", "这次按年龄选了时钟，你交来的检验里没有对上点名的指标。"]
    return paragraphs, items


def fixture_rows():
    return [
        {"indicator": "age", "value": "40"},
        {"indicator": "urea", "value": "8.2"},
        {"indicator": "albumin", "value": "38"},
        {"indicator": "glucose", "value": "6.1"},
    ]


def write_fixture(path: Path) -> None:
    path.write_text("indicator,value\nage,40\nurea,8.2\nalbumin,38\nglucose,6.1\n", encoding="utf-8")


def check_published_numbers():
    assert VISITS == 24633025
    assert PEOPLE == 9680764
    assert INDICATORS == 184
    assert UKB_MAE == 4.14
    assert DIABETES_AUC == 0.98
    assert CAD_AUC == 0.98
    text = render_body(fixture_rows())
    names = [item["name"] for item in text[1]]
    assert names == ["尿素", "白蛋白"]
    child = render_body(
        [
            {"indicator": "age", "value": "10"},
            {"indicator": "ast", "value": "20"},
            {"indicator": "urea", "value": "5"},
        ]
    )
    assert [item["name"] for item in child[1]] == ["谷草转氨酶"]
    adult = render_body(
        [
            {"indicator": "age", "value": "40"},
            {"indicator": "standardized_age_difference", "value": "3.2"},
            {"indicator": "urea", "value": "8"},
        ]
    )
    assert [item["name"] for item in adult[1]] == ["过度偏离", "尿素"]
    middle = render_body(
        [{"indicator": "age", "value": "40"}, {"indicator": "standardized_age_difference", "value": "0.4"}]
    )
    assert middle[1][0]["name"] == "平均偏离"
    child_diff = render_body(
        [{"indicator": "age", "value": "10"}, {"indicator": "standardized_age_difference", "value": "4"}]
    )
    assert [item["name"] for item in child_diff[1]] == []
