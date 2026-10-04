"""Published numbers and the personal list. No regression weights are stored here."""

from __future__ import annotations

import csv
from pathlib import Path

BOUNDARY = (
    "边界: 这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)


FULL_TEXT = True
PARTICIPANTS = 55028
PROAGE_MAE_TRAIN = 2.23
PROAGE_MAE_TEST = 2.36
CPROAGE_MAE = 3.25
NONZERO_PROTEINS_LOW = 2139
NONZERO_PROTEINS_HIGH = 2190
CARDIOMETABOLIC_REPLICATED = 166
CARDIOMETABOLIC_PANEL = 226
GCIPL_BETA = -0.15

CLOCKS = ["proage", "cproage"]


def render_body(rows):
    found = {}
    for row in rows:
        clock = (row.get("clock") or "").casefold().replace(" ", "")
        if clock not in CLOCKS:
            continue
        value = row.get("predicted_age") or ""
        if value == "":
            continue
        found[clock] = value
    labels = {"proage": "ProAge", "cproage": "cProAge"}
    items = []
    for clock in CLOCKS:
        if clock not in found:
            continue
        items.append(
            {
                "name": labels[clock],
                "aliases": [labels[clock], clock],
                "detail": f"你提供的预测年龄是 {found[clock]}。加速年龄是把实际年龄对蛋白年龄回归后的残差，回归系数没有印出来，所以这里不算。",
            }
        )
    if items:
        sentence = "这次记下你提供的蛋白预测年龄。加速年龄的回归系数没有印出来，所以没有计算。"
    else:
        sentence = "没有提供 ProAge 或 cProAge 的预测年龄，这次没有名单。"
    return ["# 眼衰老蛋白时钟", "", sentence], items


def fixture_rows():
    return [
        {"clock": "cProAge", "predicted_age": "61"},
        {"clock": "ProAge", "predicted_age": "58"},
        {"clock": "retina", "predicted_age": "70"},
    ]


def write_fixture(path: Path) -> None:
    path.write_text("clock,predicted_age\ncProAge,61\nProAge,58\nretina,70\n", encoding="utf-8")


def check_published_numbers():
    assert PARTICIPANTS == 55028
    assert PROAGE_MAE_TRAIN == 2.23
    assert PROAGE_MAE_TEST == 2.36
    assert CPROAGE_MAE == 3.25
    assert GCIPL_BETA == -0.15
    names = [item["name"] for item in render_body(fixture_rows())[1]]
    assert names == ["ProAge", "cProAge"]
