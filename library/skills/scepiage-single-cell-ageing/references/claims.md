# 论文、脚本、另一个项目

## 论文声称

Fig. 3A、B：交叉验证 MAE 在血液是 8.2 周，在肝脏是 3.9 周；用到全部批量训练数据后，血液仍是 8.2 周，肝脏是 4.6 周。Fig. 3C、D：留出样本的 MAE 是肝脏 5 周、血液 10 周。和 Stubbs 等多组织时钟比，在两边训练集都包含的 n = 63 个样本上，Stubbs 的 MAE 是 0.8 周，scEpiAge 肝脏是 3 周；两个预测之间的 Pearson r² 是 0.87，Stubbs 对实足年龄是 0.92，scEpiAge 肝脏对实足年龄是 0.88。这组对比不是血液模型的误差。

## 代码实际计算

方法仓库是 https://github.com/EpigenomeClock/scEpiAge ，分析仓库是 https://github.com/EpigenomeClock/scAgingPaper ，都克隆在 /tmp/paper-code/p35/。`predictAges` 对每个周龄列求 sum(log(1 − |期望 − 观测|))，预测年龄是达到最大的列名的中位数再取 floor。可用位点加备份位点少于 5 个就跳过。这句话在仓库里，正文没有印这个 5。本技能使用仓库里的血液期望矩阵和血液备份表：主位点 750 个，和 Methods 选出的最优位点数一致。主位点缺失时，按备份表补一个用户已经给出的备份位点。没有跑 Gravina 的覆盖文件，不能把仓库里的示例预测说成这次算过。

## 同名的另一个项目

Stubbs 等的多组织回归时钟要求同一批 CpG，论文写明它在 Meer 和 Thompson 的样本上给不出预测。scEpiAge 仓库 README 仍自称 AgingClock_v2，那是同一份预测代码的旧标题，不是第二个时钟。
