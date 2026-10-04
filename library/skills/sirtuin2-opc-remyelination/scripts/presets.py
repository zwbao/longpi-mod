"""Ma et al., Nature Communications 2022. Localization ratio uses the user's two counts."""

from decimal import Decimal

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Fig. 1l–o. Old nuclear SIRT2-positive OPCs relative to young. Cohort observation.
OLD_OVER_YOUNG = "1/3"
# Methods. Daily intraperitoneal dose in mice.
DOSE_MG_PER_KG = 10
# Methods. Concentration in primary OPC culture.
CULTURE_MM = 1
# Fig. 6a. Thiamet-G fully blocked the differentiation effect above this dose.
TM_BLOCK_UM = 5
# Data availability.
PROTEOME_PXD = "PXD022046"
PROTEOME_IPX = "IPX0002529000"

COMPOUND_ALIASES = (
    ("β-烟酰胺单核苷酸", "β-NMN"),
    ("烟酰胺单核苷酸", "β-NMN"),
    ("nicotinamide mononucleotide", "β-NMN"),
    ("β-nicotinamide mononucleotide", "β-NMN"),
    ("beta-nmn", "β-NMN"),
    ("b-nmn", "β-NMN"),
    ("β-nmn", "β-NMN"),
    ("nmn", "β-NMN"),
)


def nucleus_ratio(nucleus: Decimal, total: Decimal):
    if total == 0:
        return None
    return nucleus / total
