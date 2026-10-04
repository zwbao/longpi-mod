# 主张

全文已读：EuropePMC PMC12371080，本地 PDF 为同一篇。

## 论文声称什么

IAM Frontier 队列上计算了 29 个表观遗传、4 个临床生化、2 个蛋白组和 3 个代谢组时钟，并实际考察了 26 个生物年龄时钟。正文写 MethylDetectR 与 Skin & Blood 的相关最高，分别为 0.90 和 0.87；后文又写 MethylDetectRAge 的 Pearson 相关为 0.91。GrimAge 为 0.85，KDM-Levine 为 0.76。GrimAge 和 KDM 把实际年龄写进算法。白蛋白同时进入 MLR-Levine 和 Metabo-MD。个体稳定度写成时间点两两差值均值的倒数；0 到 1 缩放的具体做法没有写全。正文只写表观遗传时钟最稳、其后是临床和蛋白组，没有给出 0.164 这类类别平均数。Skin & Blood 技术重复的最大绝对差写为 2.56 年，用来判断生物学差异的门槛是这个数加上两次测量之间经过的实足年数。

## 代码实际算什么

JSON 里的 biolearn、DunedinPoAm38、FlowSorted.Blood.EPIC、EpiSmokEr 和 dnamalci 是这些既有时钟的实现，不是这篇论文新写的系数。本技能没有克隆它们。本技能只对用户已经给出的生物年龄计算未缩放的个体稳定度：差值取绝对值，避免正负抵消。这是正文没有写死的操作定义。Skin & Blood 若同时给出 time_years，才把相邻绝对差和 2.56 加经过年数比较。

## 同名的另一个项目

MethylDetectR 是 Hillary 与 Marioni 的甲基化软件。DunedinPACE 是另一套节奏时钟。它们不是 IAM Frontier 这篇数字孪生分析本身。
