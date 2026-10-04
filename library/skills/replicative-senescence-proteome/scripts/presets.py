"""da Silva Fernandes et al., Nat Commun 2026. Frozen equal-cell significant subset."""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
    "补充表里的队列蛋白质组变化不是你的个人衰老诊断。"
)

TABLE_NAME = "equal_cell_significant.csv"
TABLE_SOURCE = (
    "Supplementary Data 1 / MOESM3 sheet Proteome_equal_cell_number; "
    "rows with non-empty Cluster (Increased or Decreased in senescence)"
)
# Published equal-cell significant rows frozen in CSV (includes one duplicate symbol and one shared UniProt).
N_FROZEN = 1240
CODE_REPO = "https://github.com/ndasilva13/Proteomics-data-analysis---Replicative-Senescence"


@lru_cache(maxsize=1)
def load_table():
    path = Path(__file__).with_name(TABLE_NAME)
    rows = []
    by_symbol = {}
    by_uniprot = {}
    with path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            symbol = (row.get("symbol") or "").strip()
            uid = (row.get("uniprot_id") or "").strip()
            entry = {
                "symbol": symbol,
                "uniprot_id": uid,
                "log2_age4_over_age1": row.get("log2_age4_over_age1"),
                "adj_p_val": row.get("adj_p_val"),
                "cluster": (row.get("cluster") or "").strip(),
            }
            rows.append(entry)
            if symbol:
                by_symbol.setdefault(symbol.upper(), entry)
            if uid:
                by_uniprot.setdefault(uid.upper(), entry)
    return rows, by_symbol, by_uniprot
