# 论文、仓库、另一套同名东西

Higgins-Chen 等，Nature Aging（2022），doi:10.1038/s43587-022-00248-2。EuropePMC fullTextXML 返回 HTTP 500。全文改从 NCBI PMC9586209 的 XML 读到。

| | 内容 |
| --- | --- |
| 论文声称 | 36 对全血技术重复（GSE55763），年龄 37.3 到 74.6 岁。Horvath1 中位差 1.8 年、最大 4.8 年。PhenoAge 中位差 2.4 年、最大 8.6 年。PC 时钟大多数重复落在 1 到 1.5 年以内，中位差 0.3 到 0.8 年；PCPhenoAge 中位差 0.6 年、最大 1.6 年。主成分用 78,464 个 CpG。GrimAge 的 ICC 是 0.989。 |
| 代码实际算 | `MorganLevineLab/PC-Clocks` 的 `calcPCClocks` 要 `load("CalcAllPCClocks.RData")`。这次克隆里没有这个文件。`cgHorvathNew.csv` 有 30,084 行和 CoefficientHannum 列，那不是 PC 载荷。本技能不算 PC 年龄，只算用户交来的两次年龄之差。 |
| 同名的另一套 | Horvath 在线计算器是原来的 CpG 时钟，不是这篇的主成分重训。 |
