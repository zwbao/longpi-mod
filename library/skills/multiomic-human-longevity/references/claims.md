# 论文、补充表、代码、另一套同名东西

Mavromatis 等，Nature Communications（2023），doi:10.1038/s41467-023-37729-w。全文由本地 PDF 抽出，15 页。`41467_2023_37729_MOESM4_ESM.xlsx` 已打开，49 张表，目录标明 Supplementary Data 1–47。

| | 内容 |
| --- | --- |
| 论文声称什么 | 跨组织 sCCA 特征 37,917 个，Bonferroni 阈值 P < 1.32 × 10−6。高置信定义是 TWAS 显著、条件分析联合 P < 0.05，且 FOCUS PIP > 0.5。表 1 给出 22 个表观遗传年龄加速高置信关联和 7 个多变量长寿关联。FLOT1、KPNA4、TMX2 标为新基因（距来源 GWAS 领先变异超过 500 kb）。表 2 是 FDR 0.05 且 coloc SuSiE PP.H4 > 0.75 的药物靶点孟德尔随机化。正文写 TPMT 加速表型年龄和内在表观遗传年龄加速，NHLRC1 减慢内在表观遗传年龄加速。C4B 被写成加速 Hannum 年龄并降低多变量长寿，但没有通过共定位，故不在表 2。 |
| 补充表里实际有什么 | `41467_2023_37729_MOESM4_ESM.xlsx` 已打开。Supplementary Data 1 的列是 Gene、Gene name、TWAS Z-score、TWAS P-val、Best GWAS SNP ID、COLOC.PP0–PP4。Data 6 是条件分析，列有 Joint Beta、Joint Z-Value、Joint P-Value。Data 7 是 FOCUS，列有 PIP、In credible set?。Data 13 是药物靶点孟德尔随机化，列有 Beta、FDR-adjusted p-value、Coloc.susie PP.H4。这些是队列统计。没有把一个人的基因型乘进去的截距列。个人读出仍只用正文表 1 和表 2 的基因与正负号，不把 Z 或 Beta 相乘。 |
| 代码仓库实际算什么 | 论文没有单独的分析脚本仓库。Code availability 点名 FUSION（http://gusevlab.org/projects/fusion/）、FOCUS（https://github.com/bogdanlab/focus）和 TwoSampleMR 等现成软件。这些软件做的是队列 GWAS 的转录组插补和孟德尔随机化，不是把一个人的基因名对到表 1。这次没有跑这些软件。 |
| 同名的另一个项目是什么 | Hannum、Horvath、GrimAge、PhenoAge 是被当作性状的时钟，不是这篇的基因名单。这也不是有机发光二极管那篇（doi:10.1038/s41467-023-39697-7）。 |
