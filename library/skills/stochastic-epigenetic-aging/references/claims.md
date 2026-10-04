# 论文、仓库、另一套同名东西

Tong、Dwaraka、Teschendorff 等，Nature Aging 4:886–901（2024），doi:10.1038/s43587-024-00600-8。全文从本地 PDF 读过。仓库 `aet21/EpiMitClocks` 克隆在 `/tmp/paper-code/p66`。

| | 内容 |
| --- | --- |
| 论文声称 | 22,770 份样本、25 个队列。Horvath 准确度里约 66–75% 可由随机过程解释；Figure 3 的 RR2 是 0.75±0.10 和 0.66±0.11。Zhang 约 90%，RR2 0.90±0.08。PhenoAge 是 63%。Horvath 353 个 CpG，Zhang 514，PhenoAge 513。MESA 单核细胞 1,202 人，年轻 43、年老 11。模拟 39 个年龄、每个 5 个样本，共 195。切换概率 pc = 1 − exp(−γ\|效应\|)，优化的 γ=9.25，σ=0.0005。男性的 Horvath 加速，以及重症新冠和吸烟者的 PhenoAge 加速，不被解释成随机速率升高。 |
| 这份 Skill 实际算 | RR2 = 随机时钟 R² / 原时钟 R²，以及用 γ=9.25 的切换概率。σ 不乘到个人值上。不把 66% 当成个人年龄加速的权重。 |
| 同名的另一套 | `EpiMitClocks` 计算 epiTOC、epiTOC2、HypoClock、RepliTali、epiCMIT 和 stemTOC 的有丝分裂年龄。那是另一组公式，不是这篇的 RR2。2016 和 2020 年的 epiTOC 论文也不是这一篇。 |
