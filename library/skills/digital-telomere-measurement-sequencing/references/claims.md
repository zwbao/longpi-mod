# 论文、仓库、另一套同名东西

Sanchez 等，Nature Communications（2024），doi:10.1038/s41467-024-49007-4。全文读自 EuropePMC PMC11189511。方法仓库 https://github.com/santiago-es/Telometer 已克隆到 /tmp/paper-code/p84。

| | 内容 |
| --- | --- |
| 论文声称 | 纳米孔数字端粒测量，分辨率最高到 30 bp。图三b：年轻 18–20 岁 5 人 834 条，中年 35–65 岁 6 人 1882 条，老年大于 70 岁 3 人 1036 条。健康 14 人，端粒生物学异常 8 人。逻辑回归（scikit-learn 1.2.2，max_iter 1000）AUC：有症状对健康 0.95，无症状携带者对健康 0.90，合并对健康 0.91。 |
| 代码实际算 | Telometer 用正则从比对读取端粒，捕获文库默认最短读长 1000 bp，全基因组建议 4000 bp。README 写最小 bam 的概括：最小 583、下四分位 2714、中位数 3767、平均 3861、上四分位 4711、最大 20233。本技能没有重跑那份 bam。个人读出只概括用户给的长度，四分位用 Python statistics.quantiles 的 inclusive（对应 R 的 type 7）。不拟合逻辑回归。 |
| 同名的另一套 | telomerecat 用短读段覆盖度估计端粒，不是这个纳米孔正则。论文里的 TRF Southern 是对照实验，不是 Telometer。 |
