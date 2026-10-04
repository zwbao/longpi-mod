# 论文、补充表、仓库、另一套同名东西

Wagner 等，Nature Biotechnology（2024），doi:10.1038/s41587-023-01751-6。正文前二十页和后面的方法已读。`41587_2023_1751_MOESM2_ESM.xlsx` 已打开。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 结果写纳入 771 个高质量样本，覆盖 16 个器官、十个时间点。八个全局衰老 miRNA 在方法里点名：随年龄上升的是 miR-29a-3p、miR-29c-3p、miR-155-5p、miR-184-3p、miR-1895；随年龄下降的是 miR-300-3p、miR-487b-3p、miR-541-5p。局部与全局的分界是 Spearman 相关超出 −0.5 到 0.5，且全局要多于五个组织（图 2）。相对 3 月龄的倍数低于 2/3 或高于 3/2 算失调。miRNA 靶点用 r < −0.4 且 P < 0.05。图 3a 把 Eln、Col1a1、Col3a1 写成共有靶点。数据在 GSE217458 和 GSE222857。 | 正文把样本信息放在 Supplementary Table 1，覆盖长度放在 Supplementary Table 2，跨组织相关放在 Supplementary Table 3，时间点失调放在 Supplementary Table 4，靶点放在 Supplementary Table 5，旁系同源放在 Supplementary Table 7，分类后的 Spearman r 与 P 值放在 Supplementary Table 8，报告基因的 3′UTR 放在 Supplementary Table 9。该工作簿已打开。Table 3 的列是 miRNA 和各组织相关系数。Table 4 的列是 Foldchange、log2FC 和检验 P 值。Table 8 的列是 tissue、RNA、p_val、corr、p_adjust。这些是小鼠队列统计，不乘到这个人的表达上。 | 数据可用性写自定义代码向通讯作者索取，没有给出仓库 URL。比对用的是已发表的 miRMaster 2.0，不是这份数据的系数表。 | Tabula Muris Senis 的 mRNA 图谱（Schaum 等，Nature，2020）是同一批小鼠的编码转录组，不是这八个全局 miRNA。 |
