# 论文、仓库、另一套同名东西

Ding 等，Nature Medicine（2026），doi:10.1038/s41591-026-04446-y。全文用 pypdf 从 PDF 抽出。系数来自已克隆的 `dingdaisy/cellage`。

| | 内容 |
| --- | --- |
| 论文声称 | 用血浆蛋白估计细胞类型生物年龄。年龄差是预测年龄减去健康对照 LOWESS 在同一实足年龄上的期望值。`cell_type_age_gap.R` 把 LOWESS 的 f 设为 2/3；健康对照少于 5 人则改用 KADRC，再不够就跳过。Apply Models 说明：女编码 1、男编码 0；训练相关 r ≥ 0.25、测试相关 r ≥ 0.15、至少 4 个蛋白才保留模型。缺蛋白在演示脚本里补 0，并说明 z 分数的 0 是人群均值。 |
| 代码实际算 | `Apply Models/SomaScan 7k models/Soma_clock_coefficients_min.csv` 有截距、Sex 和蛋白系数。`demo_apply_cell_clock.R` 做矩阵乘权重加截距，再对健康对照做 LOWESS。本技能用这张系数表做线性预测。单人文件不拟合 LOWESS。 |
| 同名的另一套 | 同一仓库还有 Olink 3k 的 xlsx 系数，列名不是 SomaScan aptamer。没有把 Olink 权重套到 SomaScan 编号上。 |
