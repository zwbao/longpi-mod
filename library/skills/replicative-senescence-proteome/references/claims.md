# 论文、补充表、仓库、另一个项目

da Silva Fernandes 等，Nature Communications（2026），doi:10.1038/s41467-026-77686-8。PMC：PMC13582980。已打开 Springer ESM：MOESM1–MOESM14（含 Supplementary Data 1–9、Reporting Summary、Peer Review、Source data）。代码仓库：https://github.com/ndasilva13/Proteomics-data-analysis---Replicative-Senescence

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| IMR90 复制性衰老进程中蛋白质组协调变化：染色质蛋白广泛减少、胞质翻译机器减少、线粒体蛋白不溶性升高等；自噬与蛋白酶体受损；与其他病理状态相比有独特衰老签名。提供按时间分辨的衰老蛋白质组资源。 | MOESM2 说明 Data 1–9 内容。Data 1（MOESM3）含 `Proteome_data`（约 7691 蛋白，含 pairwise adj.p 与 Branch/Class）、`Proteome_Z_Score_and_clusters`（5481 行；Description 写有 Clusters 列，打开后实际只有 10 列强度/Z 分数，**没有** Clusters）、`Proteome_equal_cell_number`（8095 行，含 `Cluster`：Increased 1117 / Decreased 123 / 空 6855）。本技能冻结 equal-cell 上 Cluster 非空的 1240 行。Data 2–9 为转录组、SUMO、泛素连锁、溶解度、应激原等，未全部冻进个人查表。 | GitHub 是作者 limma/K-means/PCA/Louvain/fGSEA 分析脚本与依赖说明，读的是他们本地质谱结果，不是个人血检打分器。没有提交把用户蛋白丰度映射成「个人衰老分数」的成品模型。 | 其他衰老蛋白钟或 SASP 面板。本篇是 IMR90 复制性衰老的定量蛋白质组资源，查表不等于临床衰老诊断。 |
