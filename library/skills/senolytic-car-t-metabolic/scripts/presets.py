"""Amor et al., Nature Aging 2024, doi:10.1038/s43587-023-00560-5.

The cell dose and glucose challenges are the figure and methods sentences. A difference is called only when both control P values are below 0.05. GSE243616 is the scRNA accession and is not a personal score.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

P_CUTOFF = 0.05
CAR_DOSE_TEXT = "0.5×10^6"
GLUCOSE_AGED_G_PER_KG = 2
GLUCOSE_HFD_G_PER_KG = 1
INSULIN_U_PER_KG = 0.5
GSE_ACCESSION = "GSE243616"

ALIASES = {
    "尿激酶受体嵌合抗原受体": ["尿激酶受体嵌合抗原受体", "m.uPAR-m.28z", "muparm28z", "uPAR", "upar", "嵌合抗原受体"],
}
