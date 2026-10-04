# 论文、补充表、代码、另一套同名东西

Jin 等，Nature Aging 5:275–290（2025），doi:10.1038/s43587-024-00762-5。全文由本地 PDF 抽出。补充表整本 xlsx 已下载。Supplementary Table 6 的 gene 列已读入技能。Supplementary Table 4 已打开，列是 gene、p_val、avg_log2FC、pct.1、pct.2、p_val_adj、cluster，没有截距。

| 论文声称 | 补充表里实际有 | 代码仓库实际算 | 同名的另一个项目 |
| --- | --- | --- | --- |
| 年轻供者 23–29 岁四例，生殖年龄较大 49–54 岁四例。颗粒和卵泡膜比例下降，血管内皮和淋巴管内皮比例下降，上皮是唯一比例升高的细胞类型。共同差异基因的例子包括 RICTOR、IGF1R、MAP3K5 和 APOE。原位杂交确认 RICTOR 升高、MT-ATP6 下降。mTOR 和胰岛素通路升高，蛋白酶体、细胞外基质、氧化磷酸化和碱基切除修复下降。mTOR 在比较的组织里对卵巢更突出。CEBPD 活性在老化卵巢升高。颗粒细胞到卵母细胞的 FSH 和 GDF 信号在老化组减少。老化相关差异基因数在正文写成 3,455。 | Supplementary Table 1 是供者信息。Table 6 只有 gene 一列，没有权重或截距。Table 14 来自 Ruth 等，列有 Variant_ID、Effect、SE 和 N，没有截距，也没有加总规则。Table 4 是差异基因，这次没有把 log 倍数读进技能。Table 10 开头是 Variant_ID。 | 论文给出的仓库是 https://github.com/ChenJin2020/Molecular-and-genetic-insights-into-human-ovarian-aging-from-single-nuclei-multi-omics-analyses 。正文说它分析 snRNA-seq 和 snATAC-seq，不是个人年龄权重。 | Wu 等的 FOXP1 空间转录组是另一篇卵巢图谱。Ruth 等的绝经年龄 GWAS 提供了 Table 14 的效应，不是这篇单核图谱算出来的个人年龄。 |
