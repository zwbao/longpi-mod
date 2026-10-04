# 论文、仓库、另一套同名东西

Grigolon 等，Nature Communications（2022），doi:10.1038/s41467-021-27732-4。全文读自 EuropePMC PMC8748497。仓库 https://github.com/araldi/Grigolon-et-al_GRHL1_NatureCommunications 已克隆到 /tmp/paper-code/p90。

| | 内容 |
| --- | --- |
| 论文声称 | 图一e：不热激时 grh-1 过表达品系一平均寿命 +16.3%（P < 0.001）。化合物库 2560 个，10 µmol/L 报告基因倍数至少 2 为初筛命中。图二：寿命延长超过 10% 的是伏立诺他类 HDAC 抑制剂 vorinostat（+12.3%，P < 0.001）、papaverine（+11.4%，P = 0.004）、piperlongumine（+10.7%，P = 0.021），平板浓度 1 µmol/L。空腹血糖与人 GRHL1 负相关。 |
| 代码实际算 | 仓库笔记本下载 BXD，并在 GTEx 上对 GRHL1 与年龄做 Spearman 相关和一次线性拟合。相关数值取决于未随仓库提供的表达矩阵，本技能不算那条相关，也不跑 2560 个化合物的筛选。名单只用图二点名的三个寿命结果。piperlongumine 的显示名用荜茇酰胺。 |
| 同名的另一套 | github.com/uzh/ezRun 是他们用来做 RNA-seq 的框架，不是 GRHL1 化合物筛选。GRHL2 和 GRHL3 能激活同一报告元件，论文用敲除证明三个化合物部分经由 GRHL1，不能把三者当成同一个基因。 |
