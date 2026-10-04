# 论文、脚本、另一个项目

## 论文声称

Methods 里的弹性网公式是 S = Σ m_k × coefficient_k，预测年龄 = a × (S + intercept) + c。m_k 是 0–100 的甲基化百分比。rDNA 时钟的年龄单位是周，其他小鼠时钟是月，人类血液时钟是年。系数和截距在 Supplementary Table 6。Fig. 1h：232 个 CpG 的 TIME-seq rDNA 时钟在测试集上 R = 0.95，MedAE = 1.95 个月。训练用的弹性网 α = 0.05。这组 rDNA 数字不是人类血液时钟的误差。人类血液时钟在 1056 人上训练相关是 R = 0.98，测试 R = 0.96，MedAE = 3.39 年（Results）。样本在时钟 CpG 缺失超过 10%，或总读数少于 100000，就排除。低覆盖是覆盖读数少于 10，低覆盖位点超过时钟位点数的 10% 也排除。缺失值在多样本实验里用其他样本的均值填补。

## 代码实际计算

论文 Code availability 指向 https://github.com/patricktgriffin/TIME-Seq ，已克隆到 /tmp/paper-code/p33/TIME-Seq。JSON 里的 GitHub 列表是空的。`example_clock_analysis.R` 计算 b = 加权和 + 截距，PredictedAge = a * b + c，甲基化用 Bismark 的百分比。小鼠血液时钟示例表里 pool2_7 的加权和是 −1.2931059486711043，预测年龄是 7.413145025886241 个月。低覆盖定义是覆盖度 < 10，低覆盖位点数超过时钟位点数的 10% 就排除样本。总读数少于 100000 也排除。多样本时用列均值填补缺失；单人读出不做这个填补，缺一个位点就不算年龄。甲基化不在 0 到 100 也不算。sabre 和 Bismark 是通用依赖，不是时钟本身。

## 同名的另一个项目

仓库 README 的预印本题目是 TIME-Seq Enables Scalable and Inexpensive Epigenetic Age Predictions，和正式论文不是同一标题，但是同一套系数。rDNA 时钟、多组织时钟和 Horvath 一类芯片时钟不是这次默认使用的人类血液时钟。
