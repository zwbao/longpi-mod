# 论文、补充表、仓库、另一套同名东西

Zeng 等，Nature，2026，doi:10.1038/s41586-026-10522-7。正文前 20 页和从第 11 页起的方法已读。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 炎症过后留下 HSC-iM。标志基因取 HSC-II 相对 HSC-I 的前 200 个，排序指标是 MarkerScore（四个差异统计量的几何平均）。外周血评分用 scanpy.tl.score_genes。安大略健康研究单细胞队列 428 人，按改良山间风险分和年龄分层。改良风险分用六项血常规的性别特异五年死亡系数，去掉了年龄和代谢项。系数来自 Horne 等 2009，正文没有把系数印出来。 | MOESM3 有 22 张表。ST9 列是 Gene、DESeq_stat、DESeq_logFC、DESeq_padj、sc_AUROC、sc_logFC、sc_padj、MarkerScore、Enriched_In。HSC-II 按 MarkerScore 降序，技能取前 200 个基因符号。ST4 有 Inflammation_GeoMean 等权重列，那是稳态元程序的排序权重，不是外周血分数的系数。图的源数据表（MOESM5 到 MOESM19）是图上的数值，不是这 200 个基因。 | Zenodo 18850871 的小代码包调用 score_genes，读取 Signatures/HSCII_inflammatory_memory_top200.csv 的 ensembl_gene_id。那个 csv 不在小代码包里，在数 GB 的数据包里，本次没有解压。本技能因此用补充表的基因符号做交集，不做 score_genes，也不做风险分。 | BoneMarrowMap、TARGET-seq-plus，以及 Horne 等的山间风险分，不是这一篇的炎症记忆基因表。 |
