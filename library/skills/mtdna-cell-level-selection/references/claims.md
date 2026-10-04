# 论文、补充表、仓库、另一套同名东西

Kotrys 等，Nature 629:458（2024），doi:10.1038/s41586-024-07332-0。全文由本地 PDF 抽出。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| LHON 编辑安装错义 m.11696G>A（Val313Ile），SILENT 编辑安装同义 m.11698C>T。模型把这套系统的异质性切点放在大约 56%。图 4 里错义异质性超过大约 60% 的谱系在第 0 天到第 5 天脱落。膝点过滤至少 64 个 UMI。Barnyard 实验平均每细胞 3620 条读数。半乳糖加重适合度缺陷，百分之一氧缓冲复合体 I 缺陷。 | 补充 csv 是源数据。这次没有从里面取出一组可套用的 location、depth、pitch。截短的癌细胞瘤相关 MT-ND4 变异没有在正文写出碱基坐标。 | `MoothaLab/scilite-pipeline` 做拆分条形码和异质性计数。`MoothaLab/scilite-analysis` 的 `fit_sigmoid.py` 在 location 0.4 到 0.9、depth 0.01 到 0.99、pitch 1 到 13 里搜索，不是一组印好的权重。Kimura 拟合调用 heteroplasmy 0.0.2.1。 | `StochasticBiology/heteroplasmy-analysis` 是 Kimura 分布的另一个包。SCI-LITE 改编自 sci-RNA-seq 和 Split-seq，不是那两个流程本身。 |

3620 条读数留在这里，不写进个人报告。
