# 论文、仓库、另一套同名东西

Trapp、Kerepesi、Gladyshev，Nature Aging（2021），doi:10.1038/s43587-021-00134-3。EuropePMC 全文 XML 返回 HTTP 500。全文改读 NCBI BioC 作者稿 PMC9536112。

| | 内容 |
| --- | --- |
| 论文声称 | scAge 用批量线性模型估计每个 CpG 的甲基化对年龄，再与单细胞的 0/1 状态做独立位点的似然，取最大似然年龄。图二e去掉两个离群肝细胞后，肝脏时钟 Pearson r = 0.95，中位绝对误差 2.1 个月；多组织 r = 0.86，中位绝对误差 4.5 个月。训练数据来自 GSE120132。 |
| 代码实际算 | 仓库 `run_scAge` 默认 percentile 模式、参数 1（先换成 0.99 分位）、甲基化下界 0.001、上界 0.999、月龄从 -20 到 60、步长 0.1。`construct_reference` 用 Pearson 相关和线性回归。Thompson_Liver_BL6 报告写 29 个样本、输出 743,078 个 CpG。本技能的个人读出只用该文件绝对相关最高的 8 行，年龄步长用仓库的 0.1 个月。概率被截断后，并列的最大似然保留第一个年龄，与 pandas idxmax 一致。图二 e 的中位绝对误差不写进个人报告。 |
| 同名的另一套 | 同一 README 里的浅层测序 bioRxiv，以及 Griffin 等的 TIME-Seq，不是这篇单细胞 scAge。Horvath 的批量时钟也不是这个似然。 |
