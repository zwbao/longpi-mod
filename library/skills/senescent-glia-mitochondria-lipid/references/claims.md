# 论文、补充表、仓库、另一套同名东西

Byrns 等，Nature 630:475（2024），doi:10.1038/s41586-024-07516-8。全文由本地 PDF 抽出。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 图 1 把 lamin B（Lam）、p21（dap）、p53、Sting、CtsB、Egfr、Mmp1、Mmp2、Pvf1、Timp 画在 AP1 阳性胶质更高的一组；dFos 和 dJun 也最高。图 4：AP1 阳性胶质的游离脂肪酸更多、三酰甘油更少。脂质组差异用错误发现率 0.10。爬管高度写成最大瓶高 8 cm 的百分比。流式脂质组每个重复约 100,000 个神经元。 | Supplementary Data 1 到 10 是差异表达和富集。这次没有下载 log2 倍数和校正 P 值列，所以不算加权分数。GEO 是 GSE263926、GSE263927、GSE263928、GSE263929。 | 论文给出的 GitHub 是脂质组数据：`chopralab/drosophila_brain_lipidomics_Byrns_et_all`。它不是个人衰老分数。方法里用了 DESeq2，权重没有放进这个仓库供点积。 | SenMayo 是另一套衰老基因名单。Picard、HISAT、HTSeq 是他们引用的通用工具。这不是 Bonini 实验室更早那篇创伤性脑损伤后 AP1 胶质的结果表。 |

100,000 这个细胞数留在这里，不写进个人报告。
