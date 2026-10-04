"""Numbers and bins from Chan et al., Nature 2024, doi:10.1038/s41586-024-07797-z.

Fig. 2 RPE1 bins and Fig. 3 promoter order. DEG rule is in the RNA-seq paragraph.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

DEG_FDR = 0.05
DEG_ABS_LOG_FOLD = 1.2
CLEARANCE_DAY_START = 12
CLEARANCE_DAY_END = 30
IMMUNE_DAY = 9

RPE1_BINS = ("N", "S", "M", "L", "XL")
LIVER_BINS = ("CAGGS", "PGK", "UBC")

RPE1_DETAIL = {
    "N": "没有转入 mVenus-P2A-ER-HRAS(G12V)。Fig. 2 用 N 表示未转导的 RPE1。",
    "S": "低 RAS。诱导后 SA-β-gal 没有显著升高，细胞保持增殖。Fig. 2。",
    "M": "较高 RAS。SA-β-gal 相对未诱导对照显著升高，细胞周期进展下降。Fig. 2。",
    "L": "较高 RAS。SA-β-gal 相对未诱导对照显著升高，细胞周期进展下降。Fig. 2。",
    "XL": "最高一档 RAS。SA-β-gal 显著升高。第 6 天仍有 BrdU 阳性细胞，但分选后的 XL 没有长回。Fig. 2。",
}

LIVER_DETAIL = {
    "CAGGS": "三个启动子里 RAS 最高。大约在第 12–30 天被免疫清除，第 9 天免疫细胞增加。Fig. 3。",
    "PGK": "剂量低于 CAGGS。免疫监视弱于 CAGGS，第 9 天的免疫细胞募集很少，并走向肿瘤。Fig. 3。",
    "UBC": "三个启动子里剂量最低。免疫监视在文中写成缺席，第 9 天的免疫细胞募集很少，并走向肿瘤。Fig. 3。",
}

BIN_TITLE = {
    "N": "未转导",
    "S": "低剂量",
    "M": "中等剂量",
    "L": "较高剂量",
    "XL": "最高剂量",
    "CAGGS": "最强启动子",
    "PGK": "中等启动子",
    "UBC": "最弱启动子",
}
