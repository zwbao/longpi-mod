"""Kadir et al., Brain 2026. Frozen APOE2 vs APOE3 significant pericyte proteome."""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
    "补充表里的周细胞蛋白质组差异不是你的个人认知诊断。"
)

TABLE_NAME = "apoe2_vs_apoe3_significant.csv"
TABLE_SOURCE = "File011 Signif_APOE2_vs_APOE3 (q<0.05, |log2FC|>0.58)"
N_FROZEN = 218


@lru_cache(maxsize=1)
def load_table():
    path = Path(__file__).with_name(TABLE_NAME)
    rows = []
    by_symbol = {}
    by_uniprot = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            symbol = (row.get("gene") or "").strip()
            uid = (row.get("uniprot_id") or "").strip()
            entry = {
                "gene": symbol,
                "uniprot_id": uid,
                "log2_apoe2_over_apoe3": row.get("log2_apoe2_over_apoe3"),
                "qvalue": row.get("qvalue"),
                "comparison": row.get("comparison"),
            }
            rows.append(entry)
            if symbol:
                by_symbol.setdefault(symbol.upper(), entry)
            if uid:
                by_uniprot.setdefault(uid.upper(), entry)
    return rows, by_symbol, by_uniprot
