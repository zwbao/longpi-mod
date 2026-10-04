# 论文、补充表、代码、另一套同名东西

Kedlian 等，Nature Aging（2024），doi:10.1038/s43587-024-00613-3。全文从本地 PDF 抽出。Supplementary Table 1（MOESM3）和 Table 2（MOESM4）、Table 3（MOESM5）已打开。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 人肋间肌单细胞与单核图谱，年轻与年老两组。TNF+ 肌干细胞丰度下降最明显，核糖体生物发生下降；ICA+ 里 CCL2 上调；IIX 型几乎消失，I 型比例上升；神经肌肉接头相关核增多。细胞数写在摘要里。差异表达用贝叶斯线性混合模型，LTSR 大于 0.9。 | Table 1 有供者元数据和标志基因的 logfoldchanges。Table 2 有肌干细胞标志基因、GO 和每个供者的核糖体生物发生富集分。Table 3 四张表的列是 celltype、SYMBOL、ENSEMBL、ltsr、beta_old、beta_young、prop_young、prop_old、n_cells_young、n_cells_old、log2fc、REGULATION。没有截距列。 | `Teichlab/SKM_ageing_atlas` 是注释、混合模型差异表达和作图笔记本。没有保存一套给一个人打分的权重文件。 | Lai 等 2024 的人类骨骼肌衰老多模态图谱是另一篇。muscleageingcellatlas.org 是这篇自己的浏览器，不是个人公式。 |
