"""Published numbers and the personal list. No regression weights are stored here."""

from __future__ import annotations

import csv
from pathlib import Path

BOUNDARY = (
    "边界: 这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)


FULL_TEXT = True
SAMPLES = 1076
N_REGIONS = 15
N_MICE = 59
N_AGES = 7
N_INTERVENTIONS = 2
CAS_GENES = 82
CALLOSUM_DEG_FOLD = 10
CORTEX_VELOCITY_FRACTION = 1 / 3

GENES = [
    ("Cd22", "正文把 Cd22 写进 82 个基因里上调的一组。"),
    ("Trem2", "正文把 Trem2 写进 82 个基因里上调的一组。"),
    ("Tyrobp", "正文把 Tyrobp 写进 82 个基因里上调的一组。"),
    ("C4b", "正文写 C4b 随年龄升高，在成熟少突胶质细胞里尤其明显。"),
    ("Dnajb1", "正文把 Dnajb1 写进这 82 个基因里下调的 7 个之一。"),
    ("Hsph1", "正文把 Hsph1 写进这 82 个基因里下调的 7 个之一。"),
    ("Ahsa1", "正文把 Ahsa1 写进这 82 个基因里下调的 7 个之一。"),
    ("P4ha1", "正文把 P4ha1 写进这 82 个基因里下调的 7 个之一。"),
]

REGIONS = [
    ("胼胝体", ["corpus callosum", "corp.cal", "corp.cal.", "胼胝体"], "正文写胼胝体的共同衰老特征速度最快，12 到 18 个月差异基因数约增加十倍。"),
    ("小脑", ["cerebellum", "cereb", "cereb.", "小脑"], "正文把小脑和胼胝体写成受年龄影响最大的区域。"),
    ("尾状壳核", ["caudate putamen", "caud.put", "caud.put.", "尾状壳核"], "正文把尾状壳核、小脑和胼胝体写成最早且最明显的区域。"),
    ("前部海马", ["anterior hippocampus", "hipp.ant", "hipp.ant.", "前部海马"], "正文写前部海马的共同衰老特征速度居中。"),
    ("后部海马", ["posterior hippocampus", "hipp.post", "hipp.post.", "后部海马"], "正文把海马的速度写成低于平均。"),
    ("下丘脑", ["hypothalamus", "hypoth", "hypoth.", "下丘脑"], "正文把下丘脑的速度写成低于平均；3 到 21 个月时雌性的共同衰老特征加速在下丘脑最明显。"),
    ("丘脑", ["thalamus", "丘脑"], "正文把丘脑的速度写成低于平均。"),
    ("脑桥", ["pons", "脑桥"], "方法部分列出了脑桥，结果这段没有给它单独的速度。"),
    ("延髓", ["medulla", "延髓"], "方法部分列出了延髓，结果这段没有给它单独的速度。"),
    ("嗅球", ["olfactory bulb", "olf.bulb", "olf.bulb.", "嗅球"], "方法部分列出了嗅球，结果这段没有给它单独的速度。"),
    ("脉络丛", ["choroid plexus", "chor.plx", "chor.plx.", "脉络丛"], "方法部分列出了脉络丛，结果这段没有给它单独的速度。"),
    ("室下区", ["subventricular zone", "svz", "室下区"], "方法部分列出了室下区，结果这段没有给它单独的速度。"),
    ("运动皮层", ["motor cortex", "motor area", "mot.cor", "mot.cor.", "运动皮层"], "正文写皮层速度大约是胼胝体的三分之一。"),
    ("视觉皮层", ["visual cortex", "visual area", "vis.cor", "vis.cor.", "视觉皮层"], "正文写皮层速度大约是胼胝体的三分之一。"),
    ("内嗅皮层", ["entorhinal cortex", "ent.cor", "ent.cor.", "内嗅皮层"], "正文写内嗅皮层基本不受年龄影响，没有检测到与年龄相关的模块。"),
]


def _norm(text: str) -> str:
    return text.casefold().replace(".", "").strip()


def render_body(rows):
    present = set()
    genes = {}
    for row in rows:
        present.add(_norm(row.get("region") or ""))
        gene = (row.get("gene") or "").casefold()
        if gene:
            genes[gene] = row.get("value") or ""
    items = []
    for display, aliases, note in REGIONS:
        if any(_norm(alias) in present for alias in aliases):
            items.append(
                {
                    "name": display,
                    "aliases": [display, *aliases],
                    "detail": note,
                }
            )
    for display, note in GENES:
        if display.casefold() not in genes:
            continue
        value = genes[display.casefold()]
        detail = note + " 这不是 82 基因的共同衰老分数。"
        if value != "":
            detail = f"你这次的表达值是 {value}。" + detail
        items.append({"name": display, "aliases": [display], "detail": detail})
    if any(item["name"] in {gene for gene, _ in GENES} for item in items) and not any(
        item["name"] in {display for display, _, _ in REGIONS} for item in items
    ):
        sentence = "这次只列出正文写了方向、且你测到的基因，没有计算共同衰老分数。"
    elif items:
        sentence = "这次只标出你点名、且在这张小鼠脑区图上的位置。"
        if any(item["name"] in {gene for gene, _ in GENES} for item in items):
            sentence = "这次标出你点名的脑区，并列出正文写了方向的基因，没有计算共同衰老分数。"
    else:
        sentence = "没有对上这张图上的脑区，也没有对上正文写了方向的基因，这次没有名单。"
    return ["# 小鼠脑区", "", sentence], items


def fixture_rows():
    return [
        {"region": "entorhinal cortex"},
        {"region": "corpus callosum"},
        {"region": "liver"},
    ]


def write_fixture(path: Path) -> None:
    path.write_text("region\nentorhinal cortex\ncorpus callosum\nliver\n", encoding="utf-8")


def check_published_numbers():
    assert SAMPLES == 1076
    assert N_REGIONS == 15
    assert CAS_GENES == 82
    assert CALLOSUM_DEG_FOLD == 10
    names = [item["name"] for item in render_body(fixture_rows())[1]]
    assert names == ["胼胝体", "内嗅皮层"]
    genes = render_body([{"gene": "Trem2", "value": "3"}, {"gene": "Dnajb1", "value": "0.2"}])[1]
    assert [item["name"] for item in genes] == ["Trem2", "Dnajb1"]
    assert "上调" in genes[0]["detail"]
    assert "下调" in genes[1]["detail"]
