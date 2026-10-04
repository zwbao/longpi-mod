# 论文、仓库、另一套同名东西

Lindbohm 等，Nature Aging（2022），doi:10.1038/s43587-022-00293-x。全文由 NCBI OAI 的 PMC10154235 去掉标签后读出；EuropePMC 全文接口返回 500。

| | 内容 |
| --- | --- |
| 论文声称 | 研究 1 在 1,827 个免疫与血脑屏障标志里做孟德尔随机化，127 个与致痴呆疾病有关。其中 78 个能做通路分析。摘要写：高风险人群里甲氨蝶呤相对未治疗的阿尔茨海默病风险比是 0.64（95% 区间 0.49 到 0.88）。IPW 叙述写 117,773 人。 |
| 代码实际算 | `JVLind/Dementias_and_autoimmunity` 的 `IPW_analyses` 对 G6_AD_WIDE、F5_VASCDEM、G6_PARKINSON 循环六类药：methotrexate、salazines、NSAIDs、antihistamines、corticosteroids、TNF_a_inhib。风险比是加权 Cox 系数的指数。输入是本地的 FinnGen 文件，结果 xlsx 不在克隆件里，所以这里不算新的风险比。 |
| 同名的另一套 | MR-Base 是研究 1 的数据库，不是这个 IPW。仓库里的 PRS 脚本也不是用药风险比。 |

这次核对：全文和代码说明的是队列孟德尔随机化与加权风险比。没有能乘到一个人测量上的系数。甲氨蝶呤的 0.64 留在本文件，不写进个人报告。
