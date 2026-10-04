# 论文、仓库、另一套同名东西

Nature Communications（2026），doi:10.1038/s41467-026-72861-3。全文用 pypdf 从 PDF 抽出。NCT04019197。32 周，司美格鲁肽 45 人，安慰剂 39 人。表观遗传年龄不是预设终点。

| | 内容 |
| --- | --- |
| 论文声称 | 调整分析里，司美格鲁肽相对安慰剂：PhenoAge −4.9 years/year（p = 0.004），PCGrimAge −3.1（p = 0.007），GrimAgeV2 −2.3（p = 0.009），OMICmAge −2.2（p = 0.009），RetroAge −2.2（p = 0.030），DunedinPACE −0.09 单位、慢 9%（p = 0.01）。只有 PhenoAge 在这句话里重写了 years/year，只有 DunedinPACE 重写了单位。 |
| 代码实际算 | 清单里的 methylCIPHER、OMICmAge、PC-Clocks、DunedinPACE、IC_clock 是既有时钟的实现，不是这篇试验的配对差值脚本。本技能没有克隆它们。个人读出只算用户给出的第 32 周减基线，不把组间系数当成个人权重。 |
| 同名的另一套 | IC_clock 是另一篇内在能力时钟的仓库。PC-Clocks 有 Higgins Chen 实验室和 albertchen42 两个地址，都是主成分时钟实现，不是 NCT04019197 的试验分析。 |
