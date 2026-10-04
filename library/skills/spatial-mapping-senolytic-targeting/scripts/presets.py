"""Carver et al., Nature Aging 2026, doi:10.1038/s43587-026-01154-7.

Full text read from the local PDF. Marker genes are the set named with the senescent DAM state. Mouse doses are the Methods regimen, not human doses.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

VENETOCLAX_MG_PER_KG = 50
AP20187_MG_PER_KG = 2
WEIGHTS_PRESENT = False
MARKERS = [
    "Lgals3", "Cdkn2a", "Cdkn1a", "Ccl2", "Ccl3", "Ccl4", "Ccl5", "Spp1", "Bcl2", "Apoe", "Itgax",
]
INTERVENTIONS = ["维奈克拉", "AP20187"]
ALIASES = {
    "维奈克拉": ["维奈克拉", "维奈托克", "venetoclax", "ABT-199"],
    "AP20187": ["AP20187"],
}
