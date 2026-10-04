# 海军围度体脂方程和腰围切点：合同、数值来源与核对

## 产品合同

1. 用户提供自己量的身高、颈围、腰围、臀围和性别，年龄可选。
2. 技能自带两份海军报告印出的方程、Siri 公式和三组腰围切点，不向用户要体重、体脂秤读数、论文或 PDF。
3. 报告给出体脂率估计值（不分档）、腰围身高比、腰臀比和中国中心型肥胖分类，以及超过切点时的提示。不诊断，不管体重记录和趋势。

## 来源

| 代号 | 出处 | 用到什么 | 许可 |
| --- | --- | --- | --- |
| [M] | Hodgdon JA, Beckett MB. Prediction of percent body fat for U.S. Navy men from body circumferences and height. Naval Health Research Center Report No. 84-11, 1984. DTIC ADA143890 | 男性方程、测量部位、附录 A 查表 | 美国政府报告，“Approved for public release; distribution unlimited” |
| [W] | Hodgdon JA, Beckett MB. Prediction of percent body fat for U.S. Navy women from body circumferences and height. Report No. 84-29, 1984. DTIC ADA146456 | 女性方程、测量部位、附录 A 查表 | 同上 |
| [A] | Ashwell M, Hsieh SD. Int J Food Sci Nutr 2005;56:303–307. doi:10.1080/09637480500195066 | 腰围身高比 0.5 的提出 | 只引用界值 |
| [B] | Browning LM, Hsieh SD, Ashwell M. Nutr Res Rev 2010;23:247–269. doi:10.1017/S0954422410000144 | 0.5 界值的系统综述 | 只引用界值 |
| [O] | WHO. Waist circumference and waist–hip ratio: report of a WHO expert consultation, Geneva, 8–11 December 2008（2011 年出版，ISBN 978 92 4 150149 1） | 附录表 A1 腰臀比切点；第 5.2 节测量方法 | © WHO，只摘切点 |
| [C] | WS/T 428—2013《成人体重判定》，国家卫生和计划生育委员会 2013-04-18 发布、2013-10-01 实施（全国标准信息公共服务平台显示现行） | 表 2 中心型肥胖分类；3.4 腰围定义；适用 18 岁及以上 | 推荐性卫生行业标准，只摘切点 |

报告原文都是扫描件，下面的引文是对照页面图像抄的。

## 方程（照印出的数）

- [M] 第 12 页：“The best model determined from multiple regression involving body circumferences and height measured in cm is: BODY DENSITY = − [.19077 X LOG10(ABDOMEN II CIRC. − NECK CIRC.)] + [.15456 X LOG10(HEIGHT)] + 1.0324”。
- [W] 第 12 页：“BODY DENSITY = −[.35004 X LOG10(ABDOMEN I + HIP − NECK)] +[.22100 X LOG10(HEIGHT)] +1.29579”（同样写明 “height measured in cm”）。
- 两份报告表 1 脚注：“%Fat from Siri, 1961: %BF = 100[(4.95/Body Density)−4.50]”。
- 测量部位（[M] 第 5–6 页，[W] 第 5–6 页）：Neck “Just inferior to the larynx with tape sloping slightly downward to the front”；Abdomen II “At the level of the umbilicus”（男性方程）；Abdomen I “At the level of minimal abdominal width, approximately midway between the xyphoid and the umbilicus”（女性方程）；Hip “At the level of the greatest protrusion of the gluteal muscles”（[M]；[W] 的部位清单里没有写臀围）。
- 推导人群：[M] 602 名男性海军人员，18–56 岁，R = 0.90，标准误 0.00791 g/cc，相当于 3.52 个体脂百分点；[W] 214 名女性海军人员，18–44 岁，R = 0.85，标准误 0.00796 g/cc，相当于 3.72 个百分点。

**关于“原文用英寸”**：两份报告的回归方程都是厘米；只有附录 A 的现场查表（“all measurements in inches”）是英寸。网上流传的英寸体脂率公式（男 86.010×log10(腹围−颈围) − 70.041×log10(身高) + 36.76；女 163.205×log10(腰围+臀围−颈围) − 97.684×log10(身高) − 78.387）不在这两份报告里，是后来美国国防部文件的改写，本技能不用。VitaClaw 原技能把这组英寸公式直接套在厘米数上，男性会高约 6.5 个百分点（(86.010−70.041)×log10 2.54），女性高约 26.5 个百分点。

## 核对（附录 A 查表）

用印出的厘米方程和 Siri 公式，把英寸换成厘米（×2.54）后四舍五入：

- 男性（[M] 附录 A，第 19–22 页）：从扫描件文字层读出的 1510 格里 1506 格一致，其余 4 格是正好落在 .5 附近或扫描读错的格。测试用对照页面图像核对过的 4 格：腰围减颈围 16.0/20.0/25.0/30.0 英寸、身高 65.0/68.0/69.5/66.0 英寸，印 13/20/28/37。
- 女性（[W] 附录 A，第 19 页起）：方程给出 15%–40% 的 1251 格里，1129 格差 ≤0.5（即取整后一致）、1240 格差 ≤1；低于 10% 时表比方程平均低 0.9 个百分点（97.5% 的格子差在 1.6 以内），高于 40% 时平均低 0.3。换常数或舍入方式都对不齐，报告没有说明查表另作了什么处理。本技能照印出的方程算；测试用 15%–40% 段对照页面核对过的 3 格（腰围+臀围−颈围 45.0/50.0/55.0 英寸，身高 60.0/62.0/59.0 英寸，印 18/24/33），另有一格记录偏差：36.0 英寸、身高 62.5 英寸印 0，方程给 1.8。

## 切点

| 指标 | 切点 | 出处原话 |
| --- | --- | --- |
| 腰围身高比 | ≥0.5 为风险增加 | [A] 摘要：“A boundary value of WHTR = 0.5 indicates increased risk for men and women.” [B] 摘要：“Mean boundary values for WHtR … were 0.50 for men and 0.50 for women” |
| 腰臀比 | 男 ≥0.90，女 ≥0.85：代谢并发症风险显著增加 | [O] 附录表 A1：“Waist–hip ratio ≥0.90 cm (M); ≥0.85 cm (W) Substantially increased”（表里的 cm 是笔误）。同一附录说明这些常被归到 WHO 名下的数来自 1999 年代谢综合征报告和 2000 年肥胖报告；2008 年专家咨询认为这些现行切点“simple and universally applicable”（第 5.4 节）。 |
| 中国中心型肥胖 | 男 85 ≤ 腰围 < 90 cm、女 80 ≤ 腰围 < 85 cm 为中心型肥胖前期；男 ≥90 cm、女 ≥85 cm 为中心型肥胖 | [C] 表 2“成人中心型肥胖分类”。腰围定义（3.4）：“腋中线肋弓下缘和髂嵴连线中点的水平位置处体围的周径长度”。 |

WHO 的测量方法（[O] 第 5.2 节）：腰围在髂嵴顶和最下一根可触及肋骨下缘的中点、腋中线处量；臀围在臀部最大周长处量。和 [C] 的位置一致，和海军方程的位置不同，报告里写明。

## 没有做的

- 体脂率分档：两份报告没有健康分档；美国海军 22%（男）、30%（女）是军队体重管理标准，不是健康切点，不用。VitaClaw 的 ACE 体脂分档没有一手来源，不用。
- 体重、BMI、体成分秤、DEXA/BIA 解读、体成分评分、增减重速度和目标：VitaClaw 原技能的这些部分不移植；LongPi 已经记录体重，其余没有一手来源的公式或切点。
