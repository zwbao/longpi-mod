# 论文、仓库、另一套同名东西

Sproviero 等，Nature Aging（2025），doi:10.1038/s43587-025-00926-x。全文用 pypdf 读本地 PDF。

| | 内容 |
| --- | --- |
| 论文声称 | 血液转录组里，以 \|log2 倍数\| > 0.322 且校正 P < 0.05 划分上下调基因，再比较 log10 基因长度。Fig. 4a：iPD 第 1 次访视上调 576 个、中位 29,753 bp，下调 455 个、中位 19,076 bp，Wilcoxon P = 0.0555。Fig. 4b：第 8 次访视上调 1,106 个、中位 25,706 bp，下调 229 个、中位 40,692 bp，P = 0.0011。Fig. 5a：ΔUPDRS III > 1 为严重组 n = 226，≤ 1 为轻组 n = 112。 |
| 代码实际算 | `DNAdamageinPD/Natureageing` 的基因长度脚本用 `wilcox.test` 比较上调与下调的 log10 长度，但门槛变量 `i` 和 `k` 在脚本里没有赋值。DESeq2 脚本把 alpha 设为 0.05。本技能按论文的 0.322 和 0.05 筛基因，再做未配对 Wilcoxon。仓库不带表达矩阵，这里不重跑 Salmon 或 fgsea。 |
| 同名的另一套 | Salmon、DESeq2、fgsea 是通用依赖，不是这篇的方法。仓库里没有第二套叫 ALBATRO 的实现。 |
