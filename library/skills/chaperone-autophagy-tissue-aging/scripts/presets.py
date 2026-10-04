"""Khawaja et al., Nature Aging 2025, doi:10.1038/s43587-024-00799-6.

Direction and Weight come from the code repository file cmascore_genes.xlsx, sheet all.
The notebook z-scores each gene across Tabula Muris cells. That file has no mean or sd column.
Lysosome competence is (KDendra+LAMP1+ / LAMP1+) × 100 from the results text.
Fig. 1 legend: old females, 8 mice (160 cells) in several neuronal panels.
"""

from __future__ import annotations

from pathlib import Path

import openpyxl

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "# 组织里的伴侣介导自噬"

FIG1_OLD_FEMALE_CELLS = 160
WEIGHTS_PRESENT = True
MEAN_SD_PRESENT = False

XLSX = Path(__file__).resolve().parents[1] / "data" / "cmascore_genes.xlsx"


def load_genes() -> tuple[tuple[str, int, int], ...]:
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["all"]
    rows = []
    for index, row in enumerate(ws.iter_rows(values_only=True)):
        if index == 0 or not row[1]:
            continue
        rows.append((str(row[1]), int(row[3]), int(row[4])))
    return tuple(rows)


GENES = load_genes()

# Directions stated in the abstract, Fig. 1 and the discussion. No fold changes.
DIRECTIONS = (
    "多数组织和细胞的伴侣介导自噬随年龄下降，雄性下降更大。",
    "海马神经元在雌雄都下降。",
    "体感皮层神经元只在雄性下降。",
    "内嗅皮层神经元上升。",
    "雌性脂肪组织随年龄上升，雄性不变或下降。",
    "胰腺、肾、心脏和骨骼肌大体随年龄下降。",
)
