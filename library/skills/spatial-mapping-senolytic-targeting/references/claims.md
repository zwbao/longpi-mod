# 论文、仓库、另一套同名东西

Carver 等，Nature Aging（2026），doi:10.1038/s43587-026-01154-7。全文用 pypdf 读本地 PDF。构建清单没有方法仓库。

| | 内容 |
| --- | --- |
| 论文声称 | 老年小鼠海马旁白质，尤其是海马伞（fimbria，摘要原文；RT-PCR 取材区写作 fimbria-fornix），聚集同时带 DAM 和 SenBrain 标志的小胶质细胞，包括 Lgals3。正文把这组状态写成 Cdkn2a、Cdkn1a、Ccl2 至 Ccl5、Spp1、Bcl2、Apoe、Itgax 和 Lgals3。维奈克拉 50 mg/kg 灌胃，AP20187 2 mg/kg 腹腔，用在老年小鼠。AP20187 降低 p16，AP20187 和维奈克拉都降低随年龄升高的 Lgals3，这些下降都在雌鼠白质里报告，雄鼠的转录变化更不一致（图 7：「more heterogenous in male mice」）。 |
| 代码实际算 | 没有可克隆的方法仓库。本技能对用户交来的阳性与阴性表达做 log2 倍数，这是两个数的比，不是 DESeq2 的 Wald 统计量。名单顺序按论文叙述固定。不把小鼠剂量写成权重。 |
| 同名的另一套 | 达沙替尼加槲皮素是另一套衰老细胞清除方案，这篇药理干预写的是维奈克拉和 AP20187。 |
