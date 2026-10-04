# 论文、代码、另一套同名东西

Tang 等，Nature Metabolism（2025），doi:10.1038/s42255-024-01185-7。全文来自 Europe PMC PMC11774760。仓库是 nutrition-westlake/Longitudinal-serum-proteome-mapping-for-healthy-ageing，克隆在 /tmp/paper-code/p52。

| | 内容 |
| --- | --- |
| 论文声称 | 7,565 份血清、3,796 人、9 年。86 个蛋白在发现和验证队列同方向与年龄相关（FDR < 0.05），两队列系数 Pearson r = 0.96。随机森林：408 个蛋白 AUC 0.72，86 个蛋白 AUC 0.70，前 22 个蛋白 AUC 0.70；年龄、性别、BMI 的 AUC 0.63，三者再加 22 个蛋白 AUC 0.72（Fig. 6）。PHAS 每增加 1 个标准差，慢性病风险低 72%，2 型糖尿病低 53%，血脂异常低 32%，脂肪肝低 53%，高血压低 40%。Fig. 5：A1AT 与 A2GL 各 1 个标准差，T2D 风险低 30% 与 29%，脂肪肝低 17% 与 17%。A2MG、ADIPO、GFI1、ITIH3、RAIN、VTNC 被点名为至少与两种疾病相关，正文没有给出这六个的百分比。十个疾病相关蛋白可被锌及锌化合物靶向。 |
| 代码实际算 | `analysis_model.R` 用 `randomForest(healthy~., ntree=1000)`，按 MeanDecreaseAccuracy 取前 22 行，`set.seed(10)` 后 `mtry=3` 再拟合，PHAS 是 `predict(..., type="prob")` 的健康类概率。GLMMLasso 公式里有 86 个 `stdlog` 蛋白质标识。训练矩阵、`rf_importance.csv` 和系数都没有放进仓库。 |
| 同名的另一套 | 讨论里对比的 SomaScan 或 Olink 年龄蛋白研究。那些不是这份 GLMMLasso 公式，也不是这 22 个蛋白的森林。 |

22 个蛋白的名字只存在于缺失的训练矩阵行名里，这里不编造。`analysis_model.R` 的图注把年龄、性别、BMI 的 AUC 写成 0.62，正文 Fig. 6 和 `code_for_figures.R` 是 0.63。这些队列数字留在这里，不写进个人名单，也不把 Fig. 5 的百分比套到这个人的数值上。
