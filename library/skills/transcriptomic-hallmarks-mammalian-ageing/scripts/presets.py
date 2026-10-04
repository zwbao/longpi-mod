"""Published numbers and the personal list. No regression weights are stored here."""

from __future__ import annotations

import csv
from pathlib import Path

BOUNDARY = (
    "边界: 这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)


FULL_TEXT = True
RODENT_SAMPLES = 4539
RODENT_TISSUES = 26
PRIMATE_SAMPLES = 6626
ITP_OLD_MICE = 170
ITP_YOUNG_CONTROLS = 12
ITP_INTERVENTIONS = 20

GENES = [
    ("GPNMB", ["gpnmb"], "正文把 Gpnmb 写成年龄时钟和死亡时钟共有的正向特征"),
    ("CST7", ["cst7"], "正文写 Cst7 的表达随衰老和年龄调整后的死亡升高"),
    ("CDKN1A", ["cdkn1a", "p21"], "摘要点名 CDKN1A；正文写 Cdkn1a 的表达随衰老和年龄调整后的死亡升高"),
    ("LGALS3", ["lgals3"], "正文把 Lgals3 的上调写成细胞类型之间共有的促死亡变化；蛋白水平与死亡和多病相关。没有给出转录系数"),
    ("CASP1", ["casp1"], "正文把 Casp1 的上调写成细胞类型之间共有的促死亡变化"),
    ("S100A8", ["s100a8"], "正文把 S100a8 的上调写成细胞类型之间共有的促死亡变化"),
    ("S100A4", ["s100a4"], "正文把 S100a4 的上调写成细胞类型之间共有的促死亡变化"),
    ("SPARC", ["sparc"], "正文把 Sparc 的下调写成细胞类型之间共有的变化"),
    ("VSIG4", ["vsig4"], "正文把 Vsig4 写成啮齿类和灵长类里保守上调的基因"),
    ("EDA2R", ["eda2r"], "正文把 Eda2r 写成啮齿类和灵长类里保守上调的基因"),
    ("NREP", ["nrep"], "正文把 Nrep 写成死亡时钟的负向基因，表达随衰老和年龄调整后的死亡下降"),
    ("COL1A1", ["col1a1"], "正文把 Col1a1 写成死亡时钟的负向基因，表达随衰老和年龄调整后的死亡下降"),
    ("COL3A1", ["col3a1"], "正文把 Col3a1 写成死亡时钟的负向基因，表达随衰老和年龄调整后的死亡下降"),
]


def render_body(rows):
    present = {}
    for row in rows:
        gene = (row.get("gene") or row.get("name") or "").casefold()
        if gene:
            present[gene] = row.get("value") or row.get("expression") or ""
    items = []
    for display, aliases, direction in GENES:
        value = None
        for alias in aliases:
            if alias in present:
                value = present[alias]
                break
        if value is None:
            continue
        items.append(
            {
                "name": display,
                "aliases": [display, *aliases],
                "detail": f"你这次的表达值是 {value}。{direction}。没有用系数把这个值分成高低。",
            }
        )
    if items:
        sentence = "这次只列出你测到、且正文写了方向的基因，没有计算转录年龄。"
    else:
        sentence = "没有提供正文写了方向的基因表达，这次没有名单。"
    paragraphs = ["# 转录组特征", "", sentence]
    return paragraphs, items


def fixture_rows():
    return [
        {"gene": "Cdkn1a", "value": "2.4"},
        {"gene": "Actb", "value": "10"},
        {"gene": "Col1a1", "value": "0.4"},
    ]


def write_fixture(path: Path) -> None:
    path.write_text("gene,value\nCdkn1a,2.4\nActb,10\nCol1a1,0.4\n", encoding="utf-8")


def check_published_numbers():
    assert RODENT_SAMPLES == 4539
    assert PRIMATE_SAMPLES == 6626
    assert ITP_OLD_MICE == 170
    names = [item["name"] for item in render_body(fixture_rows())[1]]
    assert names == ["CDKN1A", "COL1A1"]
    extra = render_body([{"gene": "Lgals3", "value": "1"}, {"gene": "Sparc", "value": "2"}])[1]
    assert [item["name"] for item in extra] == ["LGALS3", "SPARC"]
    assert "上调" in extra[0]["detail"]
    assert "下调" in extra[1]["detail"]
