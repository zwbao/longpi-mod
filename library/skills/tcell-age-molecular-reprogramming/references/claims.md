# 论文、补充表、仓库、另一套同名东西

Thomson 等，Nature Immunology（2023），doi:10.1038/s41590-023-01641-8。正文前二十页和后面的方法已读。`41590_2023_1641_MOESM3_ESM.xlsx` 已打开。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 发现队列的 TEA-seq 分析了 324,255 个 T 细胞，儿童和年长成人各 8 人。确认队列每个年龄组 16 人。图 5d 写 CD8 MNP-2 在儿童为 3.3%、在成人为 0.8%。单细胞确认集里从儿童 1.6% 降到年长成人 0.04%。初始 CD4 里的 SCM 从儿童 4.2% 到成人 9.2%。TOX 和 SOX4 随年龄下降，CPQ 和 STAT4 随年龄升高。MNP-2 的单细胞签名是 KLRC3+LEF1+CD8A+，表面是 CD244 高、CD11b 高。MAST 的显著标准是校正 P 值小于 0.05 且 log(fold change) 大于 0.1。处理数据在 GSE214546，原始数据计划放入 dbGaP phs003400.v1。 | 九个亚群的标记在 Supplementary Table 1，亚群特异基因在 Supplementary Table 2，队列和抗体面板在 Supplementary Table 3，分选面板在 Supplementary Table 4，TaqMan 探针在 Supplementary Table 5。该工作簿已打开。Table 1 是各亚群的 ADT 标记。Table 2 是初始 CD8 的差异基因，列有 avg_log2FC、cluster、gene。倍数不乘成个人分数，也不当成频率阈值。 | https://github.com/aifimmunology/Aging_Tcell_TEA-seq 的默认分支是 development。README 说明这是本稿的代码。目录是 01 到 04 的处理和作图脚本，没有提交可套到一个人的权重表。 | Swanson 等，eLife（2021）的 TEA-seq 是测定平台那篇方法论文，不是这份年龄对照的基因方向。 |
