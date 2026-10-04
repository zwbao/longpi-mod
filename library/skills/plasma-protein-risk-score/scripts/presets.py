"""Published hip-fracture protein betas and the printed ultrasound equation.

doi:10.1038/s43587-024-00639-7. Betas are the CHS column of Supplementary
Tables S2, S3, and S4. Inputs are per-standard-deviation protein levels.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

BONFERRONI_P = 1.0e-5
N_WEIGHTED_PROTEINS = 18
N_LASSO_PROTEINS = 22
LASSO_SPLITS = 500
LASSO_TRAIN_FRACTION = 0.70
LASSO_FOLDS = 10
EN_ALPHA = 0.9
N_EN_PROTEINS = 20
N_APTAMERS_5K = 5284
N_APTAMERS_7K = 7596
N_APTAMERS_AFTER_EXCLUSION = 4979
NRI_CATEGORY_THRESHOLD = 0.03
EBMD_COEF = 0.0025926
EBMD_OFFSET = 3.687
HUNT_COMBINED_HR = 1.56
HUNT_COMBINED_CI = (1.36, 1.79)
HUNT_13_HR = 1.56
HUNT_13_CI = (1.35, 1.80)
UKB_ALL_N = 50876
UKB_ALL_HR = 1.63
UKB_ALL_CI = (1.52, 1.76)
UKB_RANDOM_HR = 1.64
UKB_RANDOM_CI = (1.49, 1.80)
META_N = 56123
META_CASES = 1028
META_HR = 1.63
META_CI = (1.52, 1.74)
FRAX_CINDEX = 0.735
FRAX_PLUS_CINDEX = 0.776
N_OLINK_OF_18 = 13
WEIGHTS_PRESENT = True


def ebmd(bua: float, sos: float) -> float:
    return EBMD_COEF * (bua + sos) - EBMD_OFFSET


WEIGHTED = (
    ('生长激素受体', 'GHR', '2948-58', 'P10912', 'Growth hormone receptor', 'Growth hormone receptor', -0.327935708),
    ('胰岛素样生长因子结合蛋白2', 'IGFBP2', '8469-41', 'P18065', 'Insulin-like growth factor-binding protein 2', 'IGFBP-2', 0.329829513),
    ('R-spondin-1', 'RSPO1', '16614-27', 'Q2MKA7', 'R-spondin-1', 'RSPO1', 0.266127942),
    ('生长分化因子15', 'GDF15', '4374-45', 'Q99988', 'Growth/differentiation factor 15', 'MIC-1', 0.298038191),
    ('钙粘蛋白3', 'CDH3', '2643-57', 'P22223', 'Cadherin-3', 'P-Cadherin', -0.247074949),
    ('硫酸乙酰肝素N-脱乙酰酶1', 'NDST1', '6927-7', 'P52848', 'Bifunctional heparan sulfate N-deacetylase/N-sulfotransferase 1', 'NDST1', -0.229744787),
    ('单核细胞分化抗原CD14', 'CD14', '8969-49', 'P08571', 'Monocyte differentiation antigen CD14', 'CD14', 0.253545465),
    ('基质金属蛋白酶12', 'MMP12', '4496-60', 'P39900', 'Macrophage metalloelastase', 'MMP-12', 0.258910688),
    ('表皮生长因子受体', 'EGFR', '2677-1', 'P00533', 'Epidermal growth factor receptor', 'ERBB1', -0.260204041),
    ('EphA2受体', 'EPHA2', '4834-61', 'P29317', 'Ephrin type-A receptor 2', 'Epithelial cell kinase', 0.250807823),
    ('α1-抗糜蛋白酶', 'KLK3|SERPINA3', '4153-11', 'P01011', 'Alpha-1-antichymotrypsin complex', 'alpha-1-antichymotrypsin complex', 0.23252896),
    ('δ样蛋白同源物2', 'DLK2', '9359-9', 'Q6UY11', 'Protein delta homolog 2', 'EGFL9', 0.243891841),
    ('脊索蛋白样蛋白1', 'CHRDL1', '3362-61', 'Q9BU40', 'Chordin-like protein 1', 'CRDL1', 0.261928989),
    ('甘露糖结合凝集素2', 'LMAN2', '9468-8', 'Q12907', 'Vesicular integral-membrane protein VIP36', 'Lectin, mannose-binding 2', 0.250102427),
    ('附睾蛋白4', 'WFDC2', '11388-75', 'Q14508', 'WAP four-disulfide core domain protein 2', 'HE4', 0.254550754),
    ('瘦素', 'LEP', '8484-24', 'P41159', 'Leptin', 'Leptin', -0.258344785),
    ('S100A12蛋白', 'S100A12', '5852-6', 'P80511', 'Protein S100-A12', 'S100A12', 0.197511543),
    ('间α胰蛋白酶抑制重链3', 'ITIH3', '7145-1', 'Q06033', 'Inter-alpha-trypsin inhibitor heavy chain H3', 'ITIH3', 0.220318472),
)
LASSO = (
    ('肿瘤蛋白p63', 'TP63', '10040-63', 'Q9H3D4', 'P73L', 'P73L', 0.075637),
    ('蛋白酶体亚基β6型', 'PSMB6', '10530-8', 'P28072', 'PSB6', 'PSB6', 0.146876),
    ('再生基因蛋白4', 'REG4', '11102-22', 'Q9BYZ8', 'REG4', 'REG4', 0.104164),
    ('自噬相关蛋白7', 'ATG7', '12627-97', 'O95352', 'ATG7', 'ATG7', 0.099372),
    ('BAG家族分子伴侣调节因子5', 'BAG5', '12743-18', 'Q9UL15', 'BAG5', 'BAG5', 0.060115),
    ('节点蛋白', 'NODAL', '15692-300', 'Q96S42', 'NODAL', 'NODAL', 0.09763),
    ('R-spondin-1', 'RSPO1', '16614-27', 'Q2MKA7', 'RSPO1', 'RSPO1', 0.102471),
    ('钴胺素转运蛋白1', 'TCN1', '19614-8', 'P20061', 'Holo-TC I', 'Holo-TC I', 0.137959),
    ('钙粘蛋白3', 'CDH3', '2643-57', 'P22223', 'P-Cadherin', 'P-Cadherin', -0.003613),
    ('表皮生长因子受体', 'EGFR', '2677-1', 'P00533', 'ERBB1', 'ERBB1', -0.12869),
    ('补体C3a脱精氨酸', 'C3', '2755-8', 'P01024', 'C3adesArg', 'C3adesArg', -0.151949),
    ('生长激素受体', 'GHR', '2948-58', 'P10912', 'Growth hormone receptor', 'Growth hormone receptor', -0.002597),
    ('α1-抗糜蛋白酶', 'KLK3|SERPINA3', '4153-11', 'P01011', 'alpha-1-antichymotrypsin complex', 'alpha-1-antichymotrypsin complex', 0.063873),
    ('基质金属蛋白酶12', 'MMP12', '4496-60', 'P39900', 'MMP-12', 'MMP-12', 0.102147),
    ('EphA2受体', 'EPHA2', '4834-61', 'P29317', 'Epithelial cell kinase', 'Epithelial cell kinase', 0.035745),
    ('S100A12蛋白', 'S100A12', '5852-6', 'P80511', 'S100A12', 'S100A12', 0.103962),
    ('硫酸乙酰肝素N-脱乙酰酶1', 'NDST1', '6927-7', 'P52848', 'NDST1', 'NDST1', -0.17545),
    ('聚腺苷酸聚合酶γ', 'PAPOLG', '8343-224', 'Q9BWT3', 'PAPOG', 'PAPOG', 0.109732),
    ('胰岛素样生长因子结合蛋白2', 'IGFBP2', '8469-41', 'P18065', 'IGFBP-2', 'IGFBP-2', 0.172008),
    ('单核细胞分化抗原CD14', 'CD14', '8969-49', 'P08571', 'CD14', 'CD14', 0.065818),
    ('甲型肝炎病毒细胞受体1', 'HAVCR1', '9021-1', 'Q96D42', 'A weighted proteomic risk score (PrRS) was developed, including the 18 proteins passing the significance level after adjustment for multiple testing.', 'A weighted proteomic risk score (PrRS) was developed, including the 18 proteins passing the significance level after adjustment for multiple testing.', 0.118332),
    ('整合膜蛋白2C', 'ITM2C', '9523-34', 'Q9NQX7', 'ITM2C:C-term', 'ITM2C:C-term', 0.069184),
)
ELASTIC = (
    ('补体C5b-C6复合物', 'C5|C6', '4482-66', 'P01031|P13671', 'C5b, 6 Complex', 'C5b, 6 Complex', 0.177073),
    ('胰岛素样生长因子结合蛋白2', 'IGFBP2', '8469-41', 'P18065', 'IGFBP-2', 'IGFBP-2', 0.14664),
    ('基质金属蛋白酶12', 'MMP12', '4496-60', 'P39900', 'MMP-12', 'MMP-12', 0.084493),
    ('表皮生长因子受体', 'EGFR', '2677-1', 'P00533', 'ERBB1', 'ERBB1', -0.130884),
    ('钴胺素转运蛋白1', 'TCN1', '19614-8', 'P20061', 'Holo-TC I', 'Holo-TC I', 0.140226),
    ('补体C3a脱精氨酸', 'C3', '2755-8', 'P01024', 'C3adesArg', 'C3adesArg', -0.123679),
    ('IIE组磷脂酶A2', 'PLA2G2E', '2447-7', 'Q9NZK7', 'GIIE', 'GIIE', -0.264753),
    ('钙粘蛋白3', 'CDH3', '2643-57', 'P22223', 'P-Cadherin', 'P-Cadherin', -0.069303),
    ('S100A12蛋白', 'S100A12', '5852-6', 'P80511', 'S100A12', 'S100A12', 0.107576),
    ('生长激素受体', 'GHR', '2948-58', 'P10912', 'Growth hormone receptor', 'Growth hormone receptor', 0.003312),
    ('肿瘤蛋白p63', 'TP63', '10040-63', 'Q9H3D4', 'P73L', 'P73L', 0.082598),
    ('甲型肝炎病毒细胞受体1', 'HAVCR1', '9021-1', 'Q96D42', 'TIM-1', 'TIM-1', 0.119468),
    ('再生基因蛋白4', 'REG4', '11102-22', 'Q9BYZ8', 'REG4', 'REG4', 0.128773),
    ('蛋白酶体亚基β6型', 'PSMB6', '10530-8', 'P28072', 'PSB6', 'PSB6', 0.142044),
    ('R-spondin-1', 'RSPO1', '16614-27', 'Q2MKA7', 'RSPO1', 'RSPO1', 0.141735),
    ('硫酸乙酰肝素N-脱乙酰酶1', 'NDST1', '6927-7', 'P52848', 'NDST1', 'NDST1', -0.135617),
    ('聚腺苷酸聚合酶γ', 'PAPOLG', '8343-224', 'Q9BWT3', 'PAPOG', 'PAPOG', 0.121872),
    ('α1-抗糜蛋白酶', 'KLK3|SERPINA3', '4153-11', 'P01011', 'alpha-1-antichymotrypsin complex', 'alpha-1-antichymotrypsin complex', 0.049147),
    ('单核细胞分化抗原CD14', 'CD14', '8969-49', 'P08571', 'CD14', 'CD14', 0.068232),
    ('自噬相关蛋白7', 'ATG7', '12627-97', 'O95352', 'ATG7', 'ATG7', 0.119848),
)

def _norm(text: str) -> str:
    return " ".join(str(text).replace("*", "").replace("\u00a0", " ").strip().lower().split())


def _keys(row: tuple) -> set[str]:
    zh, gene, seqid, uniprot, target, protein, _beta = row
    found = {_norm(zh), _norm(gene), _norm(seqid), _norm(target), _norm(protein)}
    for bit in str(uniprot).split("|"):
        found.add(_norm(bit))
    if gene == "KLK3|SERPINA3":
        found.add("klk3")
        found.add("serpina3")
    found.discard("")
    return found


def _index(rows: tuple) -> dict[str, tuple]:
    out: dict[str, tuple] = {}
    for row in rows:
        for key in _keys(row):
            previous = out.get(key)
            if previous is not None and previous[1] != row[1]:
                raise RuntimeError(f"alias clash {key}")
            out[key] = row
    return out


_WEIGHTED_INDEX = _index(WEIGHTED)
_LASSO_INDEX = _index(LASSO)
_ELASTIC_INDEX = _index(ELASTIC)


def score_panel(panel: tuple, pairs: list[tuple[str, float]]) -> tuple[float, list[tuple[str, float]]] | None:
    index = {
        id(WEIGHTED): _WEIGHTED_INDEX,
        id(LASSO): _LASSO_INDEX,
        id(ELASTIC): _ELASTIC_INDEX,
    }[id(panel)]
    used: dict[str, tuple[tuple, float]] = {}
    order: list[str] = []
    for raw, value in pairs:
        row = index.get(_norm(raw))
        if row is None:
            continue
        seqid = row[2]
        if seqid in used:
            continue
        used[seqid] = (row, value)
        order.append(seqid)
    if not order:
        return None
    total = 0.0
    shown: list[tuple[str, float]] = []
    for seqid in order:
        row, value = used[seqid]
        total += row[6] * value
        shown.append((row[0], value))
    return total, shown
