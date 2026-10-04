"""Zhang et al., Nat Aging 2026 RamanOmics. Frozen p21+ senescence DEGs from MOESM4."""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
    "补充表里的组织 DEG 与 Raman 峰不是你的个人组织诊断。"
)

TABLE_NAME = "p21plus_sen_degs.csv"
TABLE_SOURCE = "MOESM4 DEGs_Skin/Lung (sen) p21+ old primary blocks"
N_FROZEN = 123
CODE_REPO = "https://github.com/jian-shu-lab/RamanOmics"


@lru_cache(maxsize=1)
def load_table():
    path = Path(__file__).with_name(TABLE_NAME)
    rows = []
    by_gene = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            gene = (row.get("gene") or "").strip()
            entry = {
                "gene": gene,
                "tissue_context": (row.get("tissue_context") or "").strip(),
                "avg_log2fc": row.get("avg_log2fc"),
                "p_val_adj": row.get("p_val_adj"),
            }
            rows.append(entry)
            if gene:
                by_gene.setdefault(gene.upper(), []).append(entry)
    return rows, by_gene
