"""Gulen et al., Nature 2023. Cutoff is Extended Data Fig. 10d. No personal weights."""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "# 胞质核酸感受与老年炎症"

# Extended Data Fig. 10d volcano rule. Not a regression weight.
FDR_MAX = 0.05
LOG2FC_MIN = 0.3
# Main text: snRNA-seq of 9,505 cells. Stays out of the personal report.
MICROGLIA_CELLS = 9505
FORBIDDEN = "9505"
MUST = "Stat2"
ABSENT = "Gapdh"

SAMPLE_MEASUREMENTS = """gene,avg_log2FC,p_val_adj
Stat2,0.4,0.01
Gapdh,0.1,0.9
"""

DRUGS = (
    ("H-151", "这是文中的 STING 抑制剂，不是给你的剂量。"),
    ("达沙替尼", "脂肪组织实验里把它和槲皮素一起当作衰老细胞对照，不是给你的剂量。"),
    ("槲皮素", "脂肪组织实验里把它和达沙替尼一起当作衰老细胞对照，不是给你的剂量。"),
)
DRUG_ALIASES = {
    "H-151": ("h151", "h-151"),
    "达沙替尼": ("dasatinib", "达沙替尼"),
    "槲皮素": ("quercetin", "槲皮素"),
}


def _headers(row):
    return {
        (key or "").strip().lower().replace(" ", "").replace("_", ""): (value or "").strip()
        for key, value in row.items()
        if key
    }


def _float(text):
    if text is None or str(text).strip() == "":
        return None
    try:
        return float(str(text).strip())
    except ValueError:
        return None


def evaluate(rows, age):
    del age
    items = [f"{name}。{sentence}" for name, sentence in DRUGS]
    saw_columns = False
    hits = []
    for row in rows:
        keys = _headers(row)
        gene = keys.get("gene") or keys.get("symbol") or ""
        logfc = _float(keys.get("avglog2fc") or keys.get("log2fc") or keys.get("log2foldchange"))
        padj = _float(keys.get("pvaladj") or keys.get("padj") or keys.get("fdr") or keys.get("qvalue"))
        if logfc is None or padj is None or not gene:
            continue
        saw_columns = True
        if padj <= FDR_MAX and logfc >= LOG2FC_MIN:
            hits.append((gene, logfc, padj))
    hits.sort(key=lambda item: item[0].casefold())
    for gene, logfc, padj in hits:
        items.append(
            f"{gene}。log2 倍数变化 {logfc:g}，校正后 P {padj:g}，达到扩展数据图十的门槛。"
        )
    med_names = [name for name, _sentence in DRUGS]
    for aliases in DRUG_ALIASES.values():
        med_names.extend(aliases)
    intro = "这次按论文图里的门槛看你交来的基因，不把小鼠的倍数当成你的权重。"
    can = "测量里同时有基因、avg_log2FC 和校正后 P 时，达到门槛的基因写入方法名单。名单里的三个化合物是实验用名，不是给你的剂量。"
    if saw_columns:
        cannot = (
            "不能计算 cGAS–STING 评分。打开的补充表列是基因符号、p_val、avg_log2FC、pct.1、pct.2、p_val_adj，"
            "没有系数列，也没有截距列。没有达到门槛的基因不写入名单。"
        )
    else:
        cannot = (
            "不能计算 cGAS–STING 评分。这次测量没有同时给出 avg_log2FC 和 p_val_adj，所以没有按门槛筛选。"
            "缺这两列。补充表里也没有个人评分的系数列和截距列。"
        )
    return intro, can, cannot, items, med_names
