# 论文、补充表、仓库、另一套同名东西

Wang 等，Nature Metabolism（2026），doi:10.1038/s42255-025-01443-2。正文前二十页和后面的方法已读。`42255_2025_1443_MOESM3_ESM.xlsx` 已打开。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 摘要写 Lmna 缺失上调 CTH 和 CBS，促进半胱氨酸从头合成，增加的通量进入乙酰辅酶 A，并促进 H3K9 与 H3K27 乙酰化。早衰突变 Lmna p.G609G 降低 CTH 和 CBS，并改变 H3K9 乙酰化与甲基化的平衡。图 1d 和 1n 的代谢测量是 6 个生物学重复。方法写第 10 天类胚体的单细胞实验装载 8000 个细胞。讨论写年老心肌细胞 H3K9me3 升高。测序在 GSE248534，蛋白质组在 PXD071040。细胞处理包括 UNC1999、Chaetocin、Trichostatin A 和多西环素，这些不是个人用药指令。 | 代谢通路结果指向 Supplementary Table 1。抗体和引物列在 Supplementary Table 5。Supplementary Table 1 已打开。列是 Metabolites，以及胚胎干细胞野生型和敲除的重复强度。那不是个人系数，化验值不换算成乙酰化。图 1n 的相对丰度没有在正文写成可套用的数字。 | 全文没有单独的 Code availability 段给出半胱氨酸分析仓库。方法把 DamID 流程指到 https://github.com/thereddylab/LADetector 。该仓库是 LAD 分割脚本和基因组区间文件，不计算半胱氨酸通量。 | LADetector 是 Reddy 实验室的核纤层关联结构域项目。他们先前的 GSE164069 是 Lmna 缺失细胞的染色质与转录组，不是这次的代谢系数。 |
