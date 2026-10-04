"""Published numbers and the personal list. No regression weights are stored here."""

from __future__ import annotations

import csv
from pathlib import Path

BOUNDARY = (
    "边界: 这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)


FULL_TEXT = True
PARTICIPANTS = 18645
COHORTS = 23
SAMPLES = 31083
ASSAYS = 35056
VIGNETTE_N = 5879

PROTEINS = [
    ("ACHE", "至少六个队列里，AD 血浆中升高。"),
    ("SPC25", "至少六个队列里，AD 血浆中升高；也被写成反映 APOE，并与 APOE ε4 相关。"),
    ("LRRN1", "至少六个队列里，AD 血浆中升高；也被写成反映 APOE，并与 APOE ε4 相关。"),
    ("CTF1", "至少六个队列里，AD 血浆中升高，并被写成反映 APOE。"),
    ("GDF2", "正文把它和 APOB 一起写成效应量较大，并在五个队列里独立显著；后文写它与 AD 诊断相关且不依赖 APOE ε4。"),
    ("APOB", "正文把它和 GDF2 一起写成效应量较大，并在四个队列里独立显著。"),
    ("VAT1", "至少六个队列里，AD 血浆中更低。"),
    ("GPD1", "至少六个队列里，AD 血浆中更低。"),
    ("ARPC2", "至少六个队列里，AD 血浆中更低。"),
    ("PA2G4", "至少六个队列里，AD 血浆中更低。"),
    ("RPS12", "五个队列里下降。"),
    ("NPTXR", "五个队列里下降；额颞叶痴呆中下调；也与 AD 诊断相关且不依赖 APOE ε4。正文没有给效应量。"),
    ("NT5C", "五个队列里下降。"),
    ("APLP1", "额颞叶痴呆血浆中下调。"),
    ("HS6ST3", "额颞叶痴呆血浆中下调。"),
    ("EPHA4", "被和神经可塑性连在一起。这句话没有写效应量。"),
    ("CNTFR", "被和神经可塑性连在一起。这句话没有写效应量。"),
    ("MSMP", "被和免疫激活连在一起。这句话没有写效应量。"),
    ("KLK3", "被和免疫激活连在一起。这句话没有写效应量。"),
    ("S100A13", "与 APOE ε4 相关。这句话没有写方向。"),
    ("NEFL", "与 APOE ε4 相关。这句话没有写方向。"),
]


def render_body(rows):
    present = {}
    for row in rows:
        name = (row.get("protein") or row.get("gene") or "").casefold()
        if name:
            present[name] = row.get("value") or ""
    items = []
    for name, sentence in PROTEINS:
        if name.casefold() not in present:
            continue
        value = present[name.casefold()]
        detail = sentence
        if value != "":
            detail = f"你这次的数值是 {value}。" + detail
        items.append({"name": name, "aliases": [name], "detail": detail + " 没有把数值分成高低。"})
    if items:
        sentence = "这次只列出你测到、且正文点过名的蛋白。"
    else:
        sentence = "没有对上正文点名的蛋白，这次没有名单。"
    return ["# 神经退行蛋白", "", sentence], items


def fixture_rows():
    return [
        {"protein": "NEFL", "value": "3.1"},
        {"protein": "APOE", "value": "1"},
        {"protein": "VAT1", "value": "0.4"},
    ]


def write_fixture(path: Path) -> None:
    path.write_text("protein,value\nNEFL,3.1\nAPOE,1\nVAT1,0.4\n", encoding="utf-8")


def check_published_numbers():
    assert PARTICIPANTS == 18645
    assert VIGNETTE_N == 5879
    names = [item["name"] for item in render_body(fixture_rows())[1]]
    assert names == ["VAT1", "NEFL"]
    ache = render_body([{"protein": "ACHE", "value": "1"}])[1][0]
    assert ache["name"] == "ACHE"
    assert "升高" in ache["detail"]
