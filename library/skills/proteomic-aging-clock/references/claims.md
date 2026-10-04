# 论文、仓库、另一套同名东西

Argentieri 等，Nature Medicine（2024），doi:10.1038/s41591-024-03164-7。全文读自 EuropePMC PMC11405266。

| | 内容 |
| --- | --- |
| 论文声称 | UK Biobank n = 45,441，训练 31,808、测试 13,633，按 70:30。Olink 2,897 个蛋白，Boruta 后 204 个蛋白。Fig. 2d–f：UKB 测试集 R2 = 0.88、r = 0.94；CKB n = 3,977，R2 = 0.82、r = 0.92；FinnGen n = 1,990，R2 = 0.87、r = 0.94。ProtAgeGap 是蛋白质年龄减去实足年龄。UKB 前 5% 平均差 6.3 年，后 5% 平均差 −6 年。ProtAge20 为 20 个蛋白，Supplementary Fig. 3c,d 写 r = 0.89、R2 = 0.78。 |
| 代码实际算 | `miargentieri/proteomic-age-ukb` 有 LightGBM、Boruta 和 Optuna 的训练脚本，以及 204 行的 `ProtAge_proteins_2023-12-29.csv`（基因、SHAP 均值、蛋白名、UniProt）。README 写明 ProtAge 与 ProtAge20 模型不在仓库里。本技能只用蛋白可读名和论文里的减法，不用 SHAP 均值当权重。 |
| 同名的另一套 | 同一仓库 `files/` 里的 Lehallier 2019 时钟和 Johnson 2020 蛋白名单是别的蛋白质时钟，不是这篇文章的 LightGBM。 |

这次核对：补充表 1–21 已打开。Table 1–2 是 204 和 20 个蛋白的名字，没有 LightGBM 权重。仓库 README 写明模型不在库里。个人能算的是已给出的蛋白质年龄减去实足年龄。
