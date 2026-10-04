# 论文、补充表、仓库、另一个项目

Zhang 等，Nature Aging（2026），doi:10.1038/s43587-026-01219-7。已打开 Springer ESM：MOESM1（补充说明 PDF）、MOESM2（Reporting Summary）、MOESM3（探针表）、MOESM4（标记与 DEG xlsx）、MOESM5（计数）。代码：https://github.com/jian-shu-lab/RamanOmics。数据：SenNet doi:10.60586/SNT495.DLVB.649。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| RamanOmics 把高光谱 Raman 与 snRNA-seq/空间转录组对齐，给出衰老与衰老细胞的多模态空间签名；肺与皮肤程序不同；保守脂质相关 Raman 峰约 1131–1135 cm⁻¹ 标记 p21+ 衰老细胞。 | MOESM4 含 Lung/Skin_Markers 与多张 DEGs_* (sen)/(aging)。本技能冻结皮肤与肺 p21+（old）主块基因列（gene, avg_log2FC, p_val_adj）。MOESM3 是探针序列，不是个人系数。 | GitHub 是图生成与分析定制代码，不是把用户 Raman 文件映射成个人衰老分的成品打分器。 | `replicative-senescence-proteome` 是 IMR90 蛋白质组资源。Nature Aging 短评 `s43587-026-01230-y`（chemical fingerprint）是对本方法的评论，不是另一套系数表。 |
