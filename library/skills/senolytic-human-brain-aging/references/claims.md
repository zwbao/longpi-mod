# 论文、补充表、仓库、另一套同名东西

Aguado 等，Nature Aging（2023），doi:10.1038/s43587-023-00519-6。正文用 pypdf 读本地 PDF。Supplementary Table 1 的 xlsx 已下载，列名已核对。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 八个月类器官用纳维托克 2.5 μM、ABT-737 10 μM，或达沙替尼 10 μM 加槲皮素 25 μM。感染后的单次剂量相同。K18-hACE2 小鼠灌胃是纳维托克 100 mg/kg、达沙替尼 5 mg/kg、槲皮素 50 mg/kg 或非瑟酮 100 mg/kg。方法写每组 16 只。排序用 −(P)×符号(logFC)。转录组年龄借用另一篇的脑时钟，缺失值用该时钟里预先算好的平均数。 | Supplementary Table 1 的列是 Primer、Target、Sequence。没有位点权重，没有截距。Supplementary Code 1 是 CellProfiler 的 .cppipe，用来数 SA-β-gal 阳性细胞。 | 论文没有 GitHub 仓库。成像的其余脚本向通讯作者索取。本技能只做排序分，不跑 CellProfiler，也不填时钟权重。 | 达沙替尼加槲皮素的临床衰老细胞清除是另一套方案。Magkouta 等的胶束平台也不是这篇的类器官剂量。 |
