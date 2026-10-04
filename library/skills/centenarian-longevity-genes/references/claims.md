# 论文、补充表、代码、另一套同名东西

Ying 等，Nature Communications（2024），doi:10.1038/s41467-024-52967-2。全文由本地 PDF 抽出，11 页。Supplementary Data 1 已从期刊页下载并打开。

| | 内容 |
| --- | --- |
| 论文声称什么 | 过滤后百岁老人 338 人、LGP 对照 147 人。基因水平检验 4,925 个基因，FDR < 0.05 的有 35 个，其中 14 个在 UK Biobank 父母寿命上得到间接验证（P < 0.05），图 3a 用加号标记。正文点名 RGP1、PCNX2、ANO9 为多个性状上方向一致的长寿基因。DYNC1H1、GALNT12 只在一个性状上有保护效应；PKP4 只在健康寿命上有效应；ZNF446、PLA2G4B、EFNA3、ABCF3 效应不一致。百岁组总体功能丧失负担低 11–22%（图 2，pLOF only 的 b = −5.5，p = 0.0453）。 |
| 补充表里实际有什么 | Supplementary Data 1（`41467_2024_52967_MOESM4_ESM.csv`）列名是 estimate、std.error、statistic、p.value、c2、gene、n_ctrl、n_case、plof、totalN、fdr、rank。plof 只有 M3.1。LGP Proband 有 864 行，不是正文说的 4,925 个基因。其中 fdr < 0.05 的是 11 个：ALG13、RGP1、C14orf166、OPN3、ABCA8、DRC7、ITIH2、MYOF、IGFN1、TRMT2A、ERAP2，estimate 都为负。没有 UK Biobank 验证列。ANO9 不在该文件中。PCNX2 只出现在后代行，fdr 没有过阈值。图 3a 上许多标签对不上这 11 行。缺的是与「35 个基因」和「14 个验证」对应的标记列。Supplementary Data 2 是通路，列与基因表不同，个人读出没有用通路行。 |
| 代码仓库实际算什么 | 论文给出 https://doi.org/10.5281/zenodo.13756349 ，说明是负担检验的 R 代码。Zenodo 接口这次返回 403，仓库里的脚本文件没有打开。不把这写成论文没公布代码。已打开的材料没有一份个人权重。 |
| 同名的另一个项目是什么 | GeneBass 是他们用来做父母寿命间接验证的另一套外显子关联，不是这张阿什肯纳兹百岁负担表。Longevity Genes Project 也出现在其他百岁研究里，那些变异名单不是 Supplementary Data 1。 |
