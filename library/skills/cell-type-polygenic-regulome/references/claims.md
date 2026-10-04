# 论文、仓库、另一套同名东西

Ma 等，Nature Aging（2026），doi:10.1038/s43587-025-01027-5。全文用 pypdf 读本地 PDF。

| | 内容 |
| --- | --- |
| 论文声称 | scMORE 的 TRS = GRS + CTS − s.d.(GRS, CTS)。θ 默认 0.5。每个调控子做 1,000 个匹配对照。显著性同时要求三个 P < 0.05。人中脑报告 77 个与衰老相关的 eRegulon、7 类细胞、31 种性状。Fig. 2：淋巴细胞计数（n = 171,643）在 CD8+ T 细胞得到 ZEB1、IKZF1、FOXO1、ZNF721。 |
| 代码实际算 | `mayunlong89/scMORE_reproduce` 的 `alternativeRegulonScore` 把两数标准差写成相对均值的平方和再开方，alpha 默认 1。本技能只对用户交来的 CTS 和 GRS 做这一步。仓库脚本还依赖 MAGMA 和单细胞矩阵，那些文件不在克隆里，这里不算经验 P 值。θ 用在把 TF 和靶基因收成 GRS 的那一步，不再乘到已经汇总的分数上。 |
| 同名的另一套 | `mayunlong89/ctDRTF` 的 README 写明它是 scMORE 的旧版，不再维护。scPagwas 是同一作者更早的另一篇方法。 |
