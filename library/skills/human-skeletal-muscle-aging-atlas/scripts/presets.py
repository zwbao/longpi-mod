"""Directions stated in Kedlian et al., Nature Aging 2024.

Supplementary Table 3 (MOESM5) has beta_old, beta_young and log2fc.
Those columns are a cohort contrast. There is no intercept for one person.
"""

DOI = "10.1038/s43587-024-00613-3"
TITLE = "人类骨骼肌衰老图谱"
FULL_TEXT_READ = True
# Results: 90,902 single cells.
CELL_N = 90902
BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# (key, aliases, sentence). Aliases are matched after folding spaces.
FINDINGS = (
    ("nk", ("nk细胞", "自然杀伤", "nk cell"), "自然杀伤细胞在年老肋间肌里更富集。Fig. 1。"),
    ("t", ("t细胞", "t cell"), "T 细胞在年老肋间肌里更富集。Fig. 1。"),
    ("bplasma", ("浆细胞", "b-plasma", "bplasma"), "浆细胞在年老肋间肌里更富集。Fig. 1。"),
    ("b", ("b细胞", "b cell"), "B 细胞在年老肋间肌里更富集。Fig. 1。"),
    ("mast", ("肥大细胞", "mast"), "肥大细胞在年老肋间肌里更富集。Fig. 1。"),
    ("smc", ("平滑肌", "smc", "smooth muscle"), "平滑肌细胞在年老肋间肌里更少。Fig. 1。"),
    ("arterial", ("动脉内皮", "arterial endothelial"), "动脉内皮在年老肋间肌里更少。Fig. 1。"),
    ("capillary", ("毛细血管内皮", "capillary endothelial"), "毛细血管内皮在年老肋间肌里更少。Fig. 1。"),
    ("schwann", ("施万", "schwann"), "施万细胞在年老肋间肌里更少。Fig. 1。"),
    ("fragment", ("mf-isc", "mf-iisc", "肌纤维碎片"), "年老样本里肌纤维碎片更多。Fig. 1。"),
    ("main", ("main musc", "main肌干细胞", "静息肌干细胞"), "Main 肌干细胞丰度随年龄下降。Fig. 2。"),
    ("tnf", ("tnf+", "tnf＋", "tnfrsf12a", "tnf阳性肌干细胞"), "TNF+ 肌干细胞丰度下降最明显，核糖体生物发生也下降。Fig. 2。"),
    ("ica", ("ica+", "ica＋", "icam1", "ica阳性肌干细胞"), "ICA+ 肌干细胞丰度下降，CCL2 在年老组上调。Fig. 2。"),
    ("iix", ("type iix", "iix型", "myh1"), "IIX 型快肌纤维在年老肋间肌里几乎消失。Fig. 4。"),
    ("hybrid", ("iia-iix", "杂交纤维", "hybrid"), "IIA–IIX 杂交纤维的比例没有显著变化。Fig. 4。"),
    ("iia", ("type iia", "iia型", "myh2"), "IIA 型纤维的比例没有显著变化。Fig. 4。"),
    ("type1", ("type i", "i型", "myh7", "慢肌"), "I 型慢肌纤维的比例上升。Fig. 4。"),
    ("myh8", ("myh8", "肌细胞再生"), "MYH8+ 肌细胞的比例随年龄上升。Fig. 4。"),
    ("nmj", ("nmj", "神经肌肉接头"), "与神经肌肉接头相关的核随年龄增多。摘要。"),
    ("ccl2", ("ccl2",), "年老微环境里 CCL2 上调，毛细血管和平滑肌尤其明显。Fig. 5。"),
)
