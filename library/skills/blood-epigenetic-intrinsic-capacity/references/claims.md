# 论文、仓库、另一套同名东西

Fuentealba 等，Nature Aging（2025），doi:10.1038/s43587-025-00883-5。全文读自 EuropePMC PMC12270914。

| | 内容 |
| --- | --- |
| 论文声称 | INSPIRE-T 1,014 人，五领域评估 973 人。MMSE 0–30，SPPB 0–12，PHQ-9 0–27（越高越差，要反向），视力 0–3，听力 0–2，感觉是视力和听力的平均。握力没有固定上下限，先做 z 分数，五领域平均后再做最小最大归一化。建模用 933 人的 EPIC，IC 在 0.55 到 1（低于 0.55 的占 2.9% 被排除）。弹性网 alpha = 0.9，91 个 CpG，与 IC 的相关 0.61（Fig. 2a）。与年龄的 Spearman 相关 −0.92。Framingham 1,680 人里全因死亡风险比 1.38（Fig. 4a）。 |
| 代码实际算 | `msfuentealba/IC_clock` 的 `code/figure*.R` 读 INSPIRE-T 和 Framingham 的私人文件，用 `sum(x * model$coefficient)` 加截距画图。系数对象不在仓库里。CellPlot 只被方法部分用来画 GO 图。 |
| 同名的另一套 | Horvath、Hannum、PhenoAge、GrimAge 是文中对照的时钟，不是这 91 个 CpG。 |

这次核对：Supplementary Table 1 有截距 0.7852837523517947 和 91 个 CpG 系数。临床分数先做队列 z 分数再做极差归一，均值和极差没有印成可抄的数字。位点到齐时个人报告算的是甲基化线性组合。
