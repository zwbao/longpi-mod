# CKD-EPI 2021 eGFR：合同、数值来源与核对

## 产品合同

1. 用户提供一次化验的血肌酐（必填）、胱抑素 C 和尿白蛋白/肌酐比（可选），以及年龄和性别。
2. 技能自带论文表 2 的方程系数和 KDIGO 2024 的分档、复查和转诊规则，不向用户要论文、补充表或 PDF。
3. 报告给出 eGFR（整数）、G 分档、A 分档（有比值时）、就医建议和 KDIGO 的复查说法。不诊断慢性肾脏病，不算趋势，不说任何药的剂量或增减停。

## 来源

- **[P]** Inker LA, Eneanya ND, Coresh J, et al. New creatinine- and cystatin C–based equations to estimate GFR without race. *N Engl J Med* 2021;385:1737–1749. doi:10.1056/NEJMoa2102953。正文表 2，补充附录表 S10（第 63–64 页）、表 S11（第 65–66 页）。NEJM 使用条款，无开放许可；这里只摘系数和示例值。
- **[K]** KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease. *Kidney Int* 2024;105(4S):S117–S314. doi:10.1016/j.kint.2023.10.018。CC BY-NC-ND 4.0；这里只摘切点和实践要点的意思，不复制图表。

## 方程（[P] 表 2，照印出的数）

表 2 脚注原文：“The cells show coefficients to use in the following formula: eGFR=μ×min(Scr/κ,1)^a1×max(Scr/κ,1)^a2×min(Scys/0.8,1)^b1×max(Scys/0.8,1)^b2×c^Age×d[if female]… κ is 0.7 for female participants and 0.9 for male participants”。表 S10 脚注：“Serum creatinine is expressed in mg/dl. Serum cystatin C is expressed in mg/L. To convert serum creatinine from mg/dL to µmol/L, multiply by 88.4.”

| 方程 | μ | a1（女/男） | a2 | b1 | b2 | c（年龄） | d（女性） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2021 CKD-EPI creatinine; eGFRcr(AS) | 142 | −0.241 / −0.302 | −1.200 | — | — | 0.9938 | 1.012 |
| 2021 CKD-EPI creatinine–cystatin C; eGFRcr-cys(AS) | 135 | −0.219 / −0.144 | −0.544 | −0.323 | −0.778 | 0.9961 | 0.963 |

表 S10 把同样的方程按性别和肌酐、胱抑素 C 的高低逐条写出，例如 “Female ≤0.7 GFR= 142 x (Scr/0.7)-0.241 x 0.9938Age x 1.012”，与表 2 一致。

## 核对（[P] 表 S11，模拟病人）

表 S11 印出 50 岁和 75 岁、男女、肌酐 0.6/1/1.5/2 mg/dL 的 eGFRcr(AS)，以及胱抑素 C 1 和 1.5 mg/L 时的 eGFRcr-cys(AS)，都是整数。本脚本对全部 48 格的差都小于 1（最大 0.96，不到 1%）。四舍五入和截尾都不能同时对上全部格子，表很可能是用未取整的模型系数算的，所以测试容差是 1。表 S11 里黑人和非黑人男性在胱抑素 C 1 mg/L、75 岁、肌酐 2 时印 54 和 55，同一个不含种族的方程给出两个数，也说明是取整误差。

## 分档、复查和转诊（[K]）

| 用在哪里 | [K] 的出处和原话要点 |
| --- | --- |
| eGFR 取整 | 表 11：“Report eGFR rounded to the nearest whole number”。本脚本四舍五入（0.5 进位，不用 Python 的银行家舍入），再按取整后的数分档，和化验单一致：59.5 报 60，属 G2。 |
| G1–G5 | 表 2：G1 ≥90 Normal or high；G2 60–89 Mildly decreased；G3a 45–59；G3b 30–44；G4 15–29；G5 <15 Kidney failure。脚注：没有肾损伤证据时 G1、G2 不算慢性肾脏病。 |
| A1–A3 | 表 3：A1 <30 mg/g（<3 mg/mmol）；A2 30–300 mg/g（3–30 mg/mmol）；A3 >300 mg/g（>30 mg/mmol）。表头写两列 “approximately equivalent”（30 mg/g 实际约等于 3.39 mg/mmol）。本脚本按化验单写的单位查对应那一列：3.2 mg/mmol 是 A2，而换算成 28.3 mg/g 会落在 A1。 |
| 有胱抑素 C 时用哪个数 | 推荐 1.1.2.1：“If cystatin C is available, the GFR category should be estimated from the combination of creatinine and cystatin C”。 |
| eGFR <60 标为偏低 | 表 11：“Reported eGFR levels <60 ml/min per 1.73 m2 should be flagged as being low.” |
| 复查确认 | 实践要点 1.1.1.2：偶然查到 ACR 偏高、血尿或 eGFR 偏低，要复查确认是否有慢性肾脏病。定义（表 1）：异常至少持续 3 个月。实践要点 1.1.3.1 (vi)：“repeat measurements within and beyond the 3-month point”。实践要点 1.1.3.2：不要凭一次 eGFR 或 ACR 异常认定是慢性，可能来自急性肾损伤。第 S170 页正文：复查时间按临床情况定。 |
| 尿比值确认 | 实践要点 1.3.1.2：随机尿 ACR ≥30 mg/g（≥3 mg/mmol）要用之后一次晨起第一次排尿的中段尿确认。 |
| 两项一起查 | 实践要点 1.1.1.1：有风险和已有慢性肾脏病的人，尿白蛋白和 GFR 都要查。 |
| 每年查几次 | 图 13（第 S197 页，转自 ADA/KDIGO 2022 共识）：G1/G2：A1 1、A2 1、A3 3；G3a：1、2、3；G3b：2、3、3；G4：3、3、4+；G5：4+。图中 A 列写作 30–299 和 ≥300 mg/g，和表 3 在正好 300 时不同；本脚本先按表 3 定 A，再查图 13。只在 eGFR <60 或 A2 及以上、且 G 和 A 都有时给出，因为这张图是给已确认的慢性肾脏病人用的。 |
| 转诊 | 图 48（第 S255 页）：“eGFR <30 ml/min per 1.73 m2” 列为转到肾脏专科的情形之一。 |

## 就医建议的规则

- eGFR（分档用的那个数）<30，或 A3：尽快就诊（肾内科）。
- eGFR <60，或 A2：建议就诊（肾内科或内科），并写上面的复查说法。
- 其他：不需要特别就诊。没有比值时提醒按实践要点 1.1.1.1 补查。

## 没有做的

- **只用胱抑素 C 的 2012 方程（eGFRcys）**：[P] 表 2 和表 S10 印了系数（133、−0.499、−1.328、0.9962、女性 0.932；原始论文 Inker 2012 附录印作 0.996），但 [P] 表 S11 和 Inker 2012（doi:10.1056/NEJMoa1114248）的附录都没有 eGFRcys 的示例值，按仓库规则不能在没有可核对数字时上线。胱抑素 C 和肌酐通常同一次抽血，按 KDIGO 推荐 1.1.2.1 用 eGFRcr-cys 分档，损失不大。
- **趋势和下降速度**：VitaClaw 原技能的记录、趋势和“每年下降多少”分级不移植；LongPi 自己比较两次化验（KDIGO 实践要点 2.1.3 以 >20% 的变化作为超出预期波动的提示，属于趋势判断，不在这里算）。
- **中国改良方程**：[K] 第 S188 页提到中国等国家有 CKD-EPI 的改良版本，本技能只实现 [P] 的方程，报告里说明化验单印的 eGFR 可能来自别的方程。
