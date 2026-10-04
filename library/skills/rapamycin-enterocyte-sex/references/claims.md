# 论文、补充表、仓库、另一套同名东西

Regan、Lu 等，Nature Aging（2022），doi:10.1038/s43587-022-00308-7。正文用 pypdf 读本地 PDF。Supplementary Tables 的 PDF 已从期刊页面下载并打开。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 果蝇食物里雷帕霉素 50、200、400 μM。雌性寿命延长，雄性不延长。50 μM 时雌性肠细胞大约是对照的 75%（正文写 approximately 75%）。雌性自噬走 H3/H4–Bchs，雄性基础自噬较高。小鼠从 3 个月给雷帕霉素，方法原文是 42 mg kg−1 body weight，包在 Eudragit 里，12 个月取组织。Fig. 8 用 p62 除以总蛋白。 | Supplementary Table 1 的列有 Median Lifespan、Maximum Lifespan、n Dead、n Censored、% Increase、log-rank p，以及 Cox 的 Coefficient、exp(coeff)、SE (coeff)、z、p。雷帕霉素系数是 −0.531，exp(coeff) 是 0.588。该表写 dead = 612。没有个人权重列。 | Data availability 只有 BioProject PRJNA877614 和 Source Data，没有代码仓库。本技能做面积比和 p62/总蛋白。不把 Cox 系数套到人身上。 | Juricic 等 2022 的早期短程雷帕霉素是另一篇。Harrison 等 2009 的小鼠终身雷帕霉素也不是这篇的肠细胞性别设计。 |
