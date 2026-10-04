"""Gupta et al., Nature 2023, doi:10.1038/s41586-023-06426-5.

Main-text thresholds only. Cohort counts stay out of the personal report.
"""

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

TITLE = "核基因与线粒体拷贝数"
DOI = "10.1038/s41586-023-06426-5"
FULL_TEXT_READ = True

# Fig. 1c and Extended Data Fig. 3d. Not used as a personal slope or mean.
PARTICIPANTS = 274832
UKB_MTCN_N = 178134
UKB_MTCN_MEAN = "61.66"
APPROX_DECLINE = "approximately 2% per decade"

# Methods, variant QC.
HET_REFERENCE_BELOW = 0.01
HET_REMOVE_BELOW = 0.05
HOMOPLASMY_AT = 0.95
COVERAGE_MIN = 100
MTCN_EXCLUDE_BELOW = 50
CONTAMINATION_EXCLUDE_ABOVE = 0.02

# Discussion: heteroplasmic SNVs accrue sharply after age 70.
AGE_SNV_AFTER = 70

# Fig. 3. Phenotype sentences are only those written in the results text.
PATHOGENIC = {
    "3243ag": ("chrM:3243:A,G", "MELAS。正文写携带者的血红蛋白 A1c、甘油三酯、听力和视力损伤更高。"),
    "1555ag": ("chrM:1555:A,G", "方法里把它用于听力损伤对照。"),
    "7445ag": ("chrM:7445:A,G", "方法里把它用于听力损伤对照。"),
    "3460ga": ("chrM:3460:G,A", "方法里把它列入 Leber 遗传性视神经病变的视力对照。"),
    "11778ga": ("chrM:11778:G,A", "方法里把它列入 Leber 遗传性视神经病变的视力对照。"),
    "14484tc": ("chrM:14484:T,C", "方法里把它列入 Leber 遗传性视神经病变的视力对照。"),
    "14459ga": ("chrM:14459:G,A", "方法里把它列入 Leber 遗传性视神经病变的视力对照。"),
    "13513ga": ("chrM:13513:G,A", "图 3 的十个致病变异之一。正文没有单独写表型方向。"),
    "8993tg": ("chrM:8993:T,G", "图 3 的十个致病变异之一。正文没有单独写表型方向。"),
    "8344ag": ("chrM:8344:A,G", "图 3 的十个致病变异之一。正文没有单独写表型方向。"),
}

CHR302_ALLELES = ("chrM:302:A,AC", "chrM:302:A,ACC", "chrM:302:A,ACCC", "chrM:302:Other")
