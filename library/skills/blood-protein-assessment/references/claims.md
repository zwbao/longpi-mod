# 论文、仓库、另一套同名东西

Gadd 等，Nature Aging（2024），doi:10.1038/s43587-024-00655-7。全文读自 EuropePMC PMC11257969。

| | 内容 |
| --- | --- |
| 论文声称 | 47,600 人、1,468 个 Olink 蛋白。3,209 个关联、963 个蛋白、21 个结局。Table 1 列出 24 个结局的发病数。至少 150 例才训练 ProteinScore，共 19 个。肌萎缩侧索硬化、子宫内膜异位症、膀胱炎看 5 年，其余看 10 年。Fig. 2b：2 型糖尿病、慢阻肺、死亡、阿尔茨海默病痴呆、缺血性心脏病、帕金森病在全部 24 个协变量之上仍有 ROC P < 0.0026。测试集 2 型糖尿病 1,105 例、3,264 对照；ProteinScore AUC 0.89，HbA1c 0.85，PRS 0.68。筛查带 42–47 mmol/mol，两次 > 48 mmol/mol 用于诊断。蛋白数从子宫内膜异位症的 5 个到死亡的 201 个。 |
| 代码实际算 | `DanniGadd/Blood_protein_levels_and_incident_disease_UK_Biobank` 的 `17_Methylpiper_train_models.R` 用 methylpiper 的 `fitMPRModelCV`（`method = 'glmnet'`，`type = 'survival'`），取 `lambda.min` 的非零系数，写到输出目录的 `weights_*.csv` 和 `model_*.rds`。克隆件里没有这些权重。 |
| 同名的另一套 | methylpiper 是拟合工具，不是 ProteinScore 本身。代谢组 MetaboScore 是文中的敏感性分析，不是这六个蛋白分数。 |

这次核对：Supplementary Table 12 有 19 个 ProteinScore 的系数，死亡 201 个蛋白，子宫内膜异位症 5 个。模型输入是秩逆正态后再缩放到均值 0、标准差 1 的蛋白量。仓库克隆件里的权重文件仍不在，表里的数字已抄进 presets。
