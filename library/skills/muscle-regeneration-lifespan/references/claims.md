# 论文、补充表、代码、另一套同名东西

Walter 等，Nature Aging（2024），doi:10.1038/s43587-024-00756-3。全文从本地 PDF 抽出。Supplementary Table 2（MOESM4）已打开。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 小鼠胫骨前肌再生的单细胞图谱，从年轻到高龄。单向 FBR 衰老特征的 ssGSEA（escape）最好，AUC 0.86。肌干细胞和祖细胞分数大于等于 2412.562 称为 senescent-like（Fig. 6a，Extended Data Fig. 10g,h）。细胞数写在结果里。空间分数另用一份 44 基因的 FBR 表和 Scanpy score_genes。 | FBR 表的列是 Gene mouse、logFC、logCPM、F、PValue、FDR。logFC 不是 escape 的权重。SenMayo 等表只有基因名。没有非线性年龄动态的系数列。 | 论文给出的是 `github.com/ldwalter/` 用户页。分析仓库 `ldwalter/Aged-Skeletal-Muscle-Regeneration` 里的 `Senescence_Scoring.R` 是训练脚本，没有存好的权重向量。`ntekasi/ST_MuSCs` 是空间笔记本。 | SenMayo 和其他外部衰老基因表是被拿来比较的名单，不是这篇的个人界值。McKellar 的肌肉再生整合是另一套数据。 |
