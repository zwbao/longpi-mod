# 论文、补充表、仓库、另一套同名东西

Ximerakis 等，Nature Aging（2023），doi:10.1038/s43587-023-00373-6。正文前二十页和后面的方法已读。`43587_2023_373_MOESM2_ESM.xlsx` 和 `MOESM3_ESM.xlsx` 已打开。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 结果写过滤后保留 105,329 个细胞，最初是 158,767 个。31 类主要细胞，75 个亚群。回春对比是 (OY−OX)−(OO−YX)，衰老加速对比是 (YO−YX)−(YY−OX)，图 4 用 FDR ≤ 0.05。正文写 41 个基因在两个对比里双向变化，其中 34 个在回春对比下降、衰老加速对比上升；Avp 和 Ivns1ab 方向相反。Maff、Hsp90aa1、Hspa1a、Adamts1、Apold1、Cyr61、Dusp1、Stmn2 被写明随年龄上升并在回春对比下降。Klf6 在内皮细胞随年龄上升，回春后下降。数据在 GSE222510。 | 细胞类型在 Supplementary Table 1，细胞数在 Supplementary Table 2，各细胞差异基因在 Supplementary Tables 3–11，与衰老不重叠的基因在 12 和 13，双向基因在 Supplementary Table 14，细胞对共享基因在 15 和 16，通路在 17。MOESM2 是细胞标记和 avg_log2FC。MOESM3 是方差分析。另打开的双向基因表有两张，列是 gene 和各细胞类型，没有 log(FC)，所以不补倍数。 | https://github.com/kmh005/rubin_parabiosis 的默认分支只有 README 和 R/scenic_function.v1.R。README 写这是 SCENIC 流程的包装。仓库没有提交差异表达系数表。 | 同一实验室 2019 年未做联体的小鼠脑单细胞图谱，以及 Broad 单细胞门户 SCP2011，是浏览数据的入口，不是本报告的系数。 |
