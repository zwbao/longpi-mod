# 论文、补充表、代码、另一套同名东西

Khawaja、Martín-Segura 等，Nature Aging（2025），doi:10.1038/s43587-024-00799-6。前二十页和方法用本地 PDF 读过。代码仓库 https://github.com/amsegura/Khawaja_et_al_2024 的 cmascore_genes.xlsx 已打开。

| | 内容 |
| --- | --- |
| 论文声称 | 年轻小鼠 4–6 个月，年老小鼠 24–28 个月。CMA 活性是每个细胞的 KDendra+LAMP1+ 点数。有能力溶酶体的比例是 (KDendra+LAMP1+ / LAMP1+) × 100。Fig. 1 图注里海马等区域年老雌性为 8 只小鼠（160 个细胞）。转录 CMA 分数给每个基因表达一个权重和方向，算法写在先前文献和本仓库笔记本里：先按细胞队列把每个基因做成 z 分数，再 score = Σ(z × Direction × Weight) / Σ(Weight)。摘要写多数器官随年龄下降，雄性更明显。讨论写雌性脂肪组织上升、雄性不变或下降。 |
| 补充表实际有什么 | 期刊页面有多份按图整理的 xlsx。本次用的基因表在代码仓库，不在那些期刊 xlsx 里。cmascore_genes.xlsx 的 sheet all 有 18 个基因，列是 Cat、Gene name、Gene name Ms、Direction、Weight、Uniprot 和 Ensembl。LAMP2 的 Direction 是 1、Weight 是 2，其余权重是 1。没有均值列，没有标准差列。 |
| 代码实际算 | 笔记本 CMA_aging_Atlas_Brain.ipynb 在整张单细胞矩阵上现算每个基因的均值和标准差。本技能不做这一步，因为个人一份表达没有那两列。两种点计数都有时，只算正文里的百分比。 |
| 同名的另一套 | Tabula Muris Senis 是表达来源，不是这份免疫荧光计数。先前描述转录分数的文献不是本表的列名。 |
