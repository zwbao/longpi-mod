"""Bold muscle-related rows from Supplementary Table 1.

MutPred2 scores above 0.5 are the table caption's pathogenicity hint.
VAFs and the somatic-variant count stay out of the personal report.
"""

DOI = "10.1038/s43587-025-00941-y"
TITLE = "再生中的体细胞突变"
FULL_TEXT_READ = True
# Supplementary Data 2. MSM somatic variant count. Not a personal score.
MSM_VARIANT_N = 2127
# Table caption: MutPred2 above 0.5 suggests pathogenicity.
MUTPRED_HINT = 0.5
BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Gene, protein changes with MutPred2 above the caption cutoff, other protein changes.
GENES = (
    ("Nhp2l1", ("p.Ala60Ser",), ()),
    ("Rpsa", ("p.His131Arg", "p.Asn110Asp"), ("p.Ala160Val",)),
    ("Gmpr", (), ()),
    ("Npm1", (), ()),
    ("Pnkd", (), ("p.Arg108His",)),
)
NPM1_NOTE = "有一行终止获得，格子里写的是功能丧失，不是 MutPred2 数字。"
