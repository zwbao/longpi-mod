# 论文、仓库、另一套同名东西

Gallrein、Meyer 等，Nature Aging 6:849–868（2026），doi:10.1038/s43587-026-01067-5。全文从本地 PDF 读过。方法仓库是 `Meyer-DH/NeuronAging`，克隆在 `/tmp/paper-code/p62`。

| | 内容 |
| --- | --- |
| 论文声称 | BitAge 把神经元分成最年轻 20%（图注 n=17）和最年老 20%（图注 n=21）。纤毛感觉神经元老化更快。丁香酸和 vanoxerine 延缓退变。放线菌酮降低翻译后减轻加速老化神经元的退变。Stochastic Clock 与 BitAge 在 Calico 数据上 Pearson 0.74。 |
| 这份 Skill 实际算 | 仓库 `Tables/BitAge_Prediction.csv` 的 128 行预测小时，以及 `NeuronAge_Code.py` 里的分位 0.2 和分箱边界 110、120、130、140 小时。在这 128 行上，分位两侧各是 26 个，对不上图注的 17 和 21。CMAP 矩阵没有随仓库提供，所以不做化合物相关性排序。 |
| 同名的另一套 | BitAge 和 Stochastic Clock 是作者此前的时钟。本仓库的 GSEA 和 Mfuzz 脚本复现通路相关和聚类，不给一个人的神经元打药物分。 |

置换检验的 100,000 次只在仓库脚本里，这份读出不重跑置换。
