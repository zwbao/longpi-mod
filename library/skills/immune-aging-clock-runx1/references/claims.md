# 论文、仓库、另一套同名东西

Ping 等，Immunity 59（2026）1039–1057.e11，doi:10.1016/j.immuni.2026.02.007。全文已读。代码仓库是 [PINGjl/Immune-clock](https://github.com/PINGjl/Immune-clock)。系数表是期刊页面上的 Table S3（mmc4.xlsx）。技能里的 `scripts/table_s3.csv` 是这张表的冻结副本，共 18851 行。

| | 内容 |
| --- | --- |
| 论文声称 | 用 glmnet 4.1.7 的 cv.glmnet 做 ElasticNet。alpha 从 0.01 到 0.99，共 99 个；lambda 在训练集上 10 折交叉验证；验证集 MAE 最低的留下。性别是协变量，女为 0、男为 1。按性别随机分成训练集和验证集，各约一半。pAge 用细胞比例，tAge 用对数转录组，TCRAge 用 TCR 指标；ptAge 和 immAge 先做 0–1 缩放再合并。衰老步伐是验证集里预测年龄对实足年龄回归的残差，两端各 20%。Δclock ≥ 7 算高置信代表。图 2B：pAge 的 MAE 是 8.48 年。图 2C：Th2 的 tAge 的 MAE 是 4.96 年。图 2C 与图 S2A：各细胞类型 tAge 的 MAE 从 4.96 到 9.86 年。图 2D 与图 S2B：非零系数基因平均 606 个。图 2E：T 细胞 ptAge 的 MAE 是 5.44 年。图 S2A：TCRAge 的 MAE 是 12.07 年。图 2F：immAge 的 R 是 0.90，MAE 是 5.66 年。图 2H：bulk-immAge 对 immAge 的 R 是 0.89。 |
| 论文仓库实际算 | 脚本读本地 `E:` 路径，把模型和系数写回本地目录。仓库里没有选中的 alpha、lambda 或系数。划分是 `set.seed(2024)`，按性别和 5 岁年龄段 `sample_frac(0.5)`。`02_gene.R` 直接读预先算好的表达表，脚本里没有再取对数。`04_combind.R` 对整张表取一个最小值和一个最大值。`06_pace_analysis.R` 的残差公式和正文一致，但两端各取 21 人，并且同时保留 Δclock ≥ 7 和 Δclock ≤ −7。 |
| 这份 Skill 实际算 | 用 Table S3 的系数做点积。pAge 用原始比例，tAge 用用户交来的对数表达，TCRAge 用原始指标，女为 0、男为 1。缺特征就不算，不用 0 去补。ptAge 和 immAge 的训练集最小值、最大值不在表里，不算。bulk-immAge 不在表里，不算。队列 MAE 不写进个人报告。 |
| 同名的另一套 | 其他免疫年龄时钟，包括甲基化时钟、pyaging 里的时钟，以及 Zhu 等 Science Advances 2023 的 PBMC 单细胞时钟，都不是这篇 ElasticNet。本仓库里的 `sex-specific-immune-aging` 也不是这一篇。 |
