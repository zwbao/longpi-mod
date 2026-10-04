"""Zhang et al., Nature Metabolism 2022. Numbers below are cited, not fitted here."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Fig. 1a,b. Approximate aldolase IC50. Not a personal dose.
IC50_APPROX_UM = 50
# Fig. 1c. Approximate KD for ALDOA.
KD_APPROX_UM = 20
# Main text: AMPK phosphorylation seen at 5 nM; AMP:ATP rises at 200 nM or higher.
AMPK_CELL_NM = 5
ENERGY_RATIO_NM = 200
# Fig. 3. Oral gavage in rodents, mg per kg.
GAVAGE_MPK = (2, 10)
# Fig. 8a text: median 18 to 26 days. Supplementary Table 2 (MOESM1) lists
# N2 vehicle median 19 days and 10 μM median 25 days, labeled Fig. 4a.
# Both stay here. The personal report uses neither.
TEXT_WORM_MEDIAN_DAYS = (18, 26)
TABLE_WORM_MEDIAN_10UM_DAYS = (19, 25)
# Fig. 8h text. Supplementary Table 2 has means and medians, not this percent column.
MALE_LIFESPAN_INCREASE_PERCENT = 7.4
FEMALE_LIFESPAN_INCREASE_PERCENT = 7.7
# Extended Data Fig. 9. Drinking water and the serum level the text pairs with 2 mpk.
DRINKING_UG_PER_ML = 100
SERUM_NM = 8
WORM_AGAR_UM = 10

COMPOUND_ALIASES = (
    ("lxy-05-029", "aldometanib"),
    ("lxy05029", "aldometanib"),
    ("aldometanib", "aldometanib"),
)
