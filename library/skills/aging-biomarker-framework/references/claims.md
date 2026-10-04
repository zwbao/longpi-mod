# 论文、仓库、另一套同名东西

Ying、Paulson、Gladyshev 等，Nature Aging 5:2323–2339（2025），doi:10.1038/s43587-025-00987-y。NCBI efetch 的 PMC13476091 作者稿读过。方法仓库 `bio-learn/biolearn` 克隆在 `/tmp/paper-code/p70`。

| | 内容 |
| --- | --- |
| 论文声称 | Biolearn 整理 39 个标志物、超过 20,000 人。年龄预测能力与死亡预测的相关 R=0.12，P=0.67。Horvath 皮肤和血液时钟年龄 R²=0.88。GrimAge2 死亡 HR=2.57，健康寿命 HR=2.00。NAS（N=1,488，死亡 38.8%）里 DunedinPoAm38 HR=1.36，GrimAgeV2 HR=1.35，DunedinPACE HR=1.35。MGB（N=500，死亡 8.8%）里 GrimAgeV2 HR=2.08，PhenoAge HR=2.03，GrimAgeV1 HR=1.84。GS（N=18,859，死亡 8.0%）里 GrimAgeV2 HR=2.57（P=6.61×10^−139），GrimAgeV1 HR=2.50，PhenoAge HR=2.16。健康寿命与寿命的加权相关 0.97，P=3.83×10^−4。 |
| 这份 Skill 实际算 | 年龄偏差 = 预测年龄 − 实足年龄，并附上正文里该时钟的队列句子。不把 HR 乘到偏差上，也不跑 CpG 模型。 |
| 同名的另一套 | `bio-learn/biolearn` 用甲基化矩阵计算时钟。methylclock 和 BioAge 是别的实现。这份读出不执行那些系数。 |
