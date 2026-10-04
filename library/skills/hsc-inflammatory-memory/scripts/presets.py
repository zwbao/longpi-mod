"""Zeng et al., Nature 2026. Top HSC-II genes by MarkerScore. No score_genes and no mIRS weights."""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "# 造血干细胞的炎症记忆"

# Ontario Health Study scRNA-seq donors in the main text. Stays out of the report.
OHS_N = 428
FORBIDDEN = "428"
MUST = "NFKB1"
ABSENT = "NOTAGENE"

SAMPLE_MEASUREMENTS = """gene,value
NFKB1,4
NOTAGENE,1
"""

# Supplementary Table 9 (MOESM3 sheet ST9), Enriched_In == HSC-II, ranked by MarkerScore.
GENES = (
    'SIPA1L1', 'ATP2B1', 'MALT1', 'CABLES1', 'AREG',
    'EZR', 'AC104365.1', 'PPP1R16B', 'TRIM24', 'RASGEF1B',
    'RELL1', 'NR4A2', 'SNX9', 'NR4A3', 'ELL2',
    'IQCJ-SCHIP1', 'SGIP1', 'ANKRD28', 'SKI', 'SYTL3',
    'PPP1CB', 'USP36', 'LMNA', 'NFKB1', 'ZSWIM6',
    'SPDYA', 'CDK17', 'LRRFIP1', 'EML4', 'BMP6',
    'ZNF331', 'DPYSL3', 'PEAK1', 'RFX2', 'DENND4A',
    'NR4A1', 'ARIH1', 'PLEKHA2', 'KLF2', 'SIK3',
    'RILPL2', 'MAN2A1', 'CRY1', 'KLF6', 'FTH1',
    'MCL1', 'OSBPL8', 'AGO2', 'SYAP1', 'PSME4',
    'FOSL2', 'RYBP', 'DNAJB6', 'SKIL', 'RANBP2',
    'IDS', 'PDE4B', 'GRASP', 'PHTF1', 'VPS37B',
    'BTD', 'DNAJC1', 'PABPC1', 'MAFF', 'USP12',
    'TCF4', 'MAP3K8', 'TIPARP', 'PDE3B', 'TSC22D2',
    'DOCK4', 'MTMR6', 'SLC45A4', 'SLC39A8', 'BRAF',
    'WT1', 'TM9SF3', 'TPM4', 'TOX', 'ADAM17',
    'CD83', 'VIM', 'ID2', 'PACSIN2', 'AC020916.1',
    'SIK2', 'TMEM241', 'NFATC1', 'CNOT2', 'RGCC',
    'KAT6A', 'NUP58', 'STX17-AS1', 'CTNNB1', 'CD109',
    'COPA', 'FAM102B', 'ATP1B3', 'NAMPT', 'RAB11A',
    'RGS2', 'SAMD4A', 'MYADM', 'TLE4', 'CREM',
    'DUSP2', 'C4orf19', 'SMAD3', 'REL', 'CHD1',
    'ELOVL5', 'JUNB', 'RRP12', 'IL1RAP', 'USP9X',
    'GAB2', 'CYTH3', 'ID1', 'CD55', 'CHST11',
    'CRIM1', 'RABGEF1', 'KMT2E', 'PTGER4', 'TACC1',
    'SRGN', 'FBXW7', 'LMBR1', 'SLC35E1', 'PPARD',
    'ESYT2', 'NFKBID', 'PER1', 'KSR1', 'WTAP',
    'GBE1', 'BTAF1', 'PPP1R15A', 'CNOT6L', 'SAMSN1',
    'YPEL5', 'ETV3', 'SH2B3', 'PIK3R1', 'PFKFB3',
    'H3F3B', 'ANKRD11', 'FOS', 'AP3M2', 'SPAG9',
    'AP003086.1', 'LATS2', 'CD44', 'FBXO34', 'KLF3',
    'SLC2A3', 'PMEPA1', 'SEMA4A', 'FAM169A', 'RELB',
    'RAB7A', 'CYTH1', 'CDK14', 'HERC1', 'FOSB',
    'HIVEP2', 'BTBD11', 'ARL4C', 'ABCC1', 'WHRN',
    'RUNX3', 'IFRD1', 'FAM163A', 'NR3C1', 'GNAS',
    'AMZ1', 'TSC22D3', 'KRAS', 'INPP5A', 'GNA12',
    'PIM3', 'SHOC2', 'RCOR1', 'GAS7', 'ST3GAL1',
    'IVNS1ABP', 'FAM13B', 'CDC42SE2', 'PER2', 'SLC7A5',
    'PLAUR', 'MAP3K2', 'MIDN', 'ACSL1', 'RAB11FIP1',
    'RAP1A', 'DDX21', 'QKI', 'KPNA4', 'RALGDS',
)

GENE_INDEX = {gene.casefold(): gene for gene in GENES}


def _headers(row):
    return {
        (key or "").strip().lower().replace(" ", "").replace("_", ""): (value or "").strip()
        for key, value in row.items()
        if key
    }


def evaluate(rows, age):
    del age
    found = {}
    for row in rows:
        keys = _headers(row)
        name = keys.get("gene") or keys.get("symbol") or keys.get("name") or keys.get("item") or ""
        value = keys.get("value") or keys.get("结果") or keys.get("expression") or ""
        canonical = GENE_INDEX.get(name.strip().casefold())
        if canonical:
            found[canonical] = value
    items = []
    for gene in GENES:
        if gene not in found:
            continue
        value = found[gene]
        if value:
            items.append(f"{gene}。你给的数是 {value}。这是补充表里炎症记忆一侧的基因。没有把它收成分数。")
        else:
            items.append(f"{gene}。名字对上了，但这次没有给出数值。没有把它收成分数。")
    intro = "这次只列出你交来的、落在补充表炎症记忆基因里的符号。缺的基因不用 0 去补。"
    if items:
        can = "对上的基因写在方法名单里，旁边是你给的数。"
    else:
        can = "这次没有基因对上补充表里的炎症记忆基因。"
    cannot = (
        "不能计算文中的 scanpy 分数。那个函数还要抽一组对照基因，补充表没有这一列。"
        "也不能计算改良风险分。正文用了六项血常规的性别特异五年死亡系数，但没有把系数印在本文或补充表里。"
        "缺的是血细胞比容、白细胞计数、血小板计数、平均红细胞体积、平均红细胞血红蛋白浓度、红细胞分布宽度这六列系数。"
        "补充表四的炎症元程序权重没有拿来做点积。"
    )
    return intro, can, cannot, items, list(found)
