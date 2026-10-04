# 论文、仓库、另一套同名东西

Zhavoronkov 等，Cell 189:5980–5994（2026），doi:10.1016/j.cell.2026.08.026。

| | 内容 |
| --- | --- |
| 论文声称 | LongevityBench 有 17 个任务、25,457 条提示。五个 Longevity-LLM 在衰老数据上微调。Longevity Claw 把 L-Qwen3.5-9B 和基因集富集、时钟、人群参照接在一起，并做了一次未做实验验证的靶点示意。经典年龄回归是对照：NHANES 弹性网络在 Table S6 的 MAE 是 11.55 年；LB-0190 的 ridge MAE 是 4.30 年。 |
| 这份 Skill 实际算 | `Insilico-org/longeclaw` 里 `drugage.py` 的综合分，和 `control_laws.py` 的八个干预向量场。DrugAge 表是该仓库 `data/drugage/drugage.csv`，3423 行、1046 个化合物名、至少两项实验的排序 599 个、ITP 化合物 54 个。雷帕霉素综合分 0.5411。50 岁典型状态的控制代价是 65.851562，贪心顺序停在雷帕霉素，二甲双胍和非瑟酮没有排到。 |
| 同名的另一套 | Hugging Face `insilicomedicine/longebench` 是评测提示集。`insilicomedicine/longevity-llm` 是 9B 权重。论文没有 DrugAge 排序，也没有 arXiv:2605.16781 的向量场。那些只在 Longevity Claw 仓库里。 |

化合物到基因的 `COMPOUND_TARGETS`，以及时钟通路连接，依赖仓库里的时钟库。这份 Skill 没有把那一步算进报告。

分数相同的化合物按名字母序排列。仓库用 set 遍历，并列时的次序不固定。
