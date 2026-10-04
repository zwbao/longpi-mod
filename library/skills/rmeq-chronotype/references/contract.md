# rMEQ：数值来源与合同

用户提供 5 道题的选项分，可选年龄。

技能自己带着每题可取的分值、4–25 的总分范围和五档切点。不向用户要论文或完整的 19 题 MEQ。

报告可以给出总分和发表的五档。它不估算生物钟时间（褪黑素起始时间），不开作息、光照或进餐时间的处方，也不诊断睡眠障碍。

## 来源

| 内容 | 取值 | 来源 |
| --- | --- | --- |
| 题目组成 | MEQ 第 1、7、10、18、19 题 | Danielsson K 等. Chronobiol Int 2019;36(4):530–540，doi:10.1080/07420528.2018.1564322（CC BY-NC-ND 4.0）："The rMEQ was developed by Adan and Almirall (1991) and only includes items 1, 7, 10, 18, and 19 of the original MEQ (Adan and Almirall 1991)." |
| 总分范围和五档 | 4–25；4–7 明确夜型，8–11 中度夜型，12–17 中间型，18–21 中度晨型，22–25 明确晨型 | Belfry KD 等. Front Psychiatry 2020，doi:10.3389/fpsyt.2020.550597（CC BY）："Scores range from 4 to 25 … rMEQ scores ranging from 4 to 7 were classified as “definite evening type”; 8 to 11 as “moderate evening type”; 12 to 17 as “intermediate type”; 18 to 21 as “moderate morning type”; and 22 to 25 as “definite morning type” chronotypes (28)"，(28) 为 Adan 和 Almirall 1991。Gooderick 等. Eur J Sport Sci 2025，doi:10.1002/ejsc.12247（CC BY）同样写明："chronotype classification as reported in Adan and Almirall (1991): definitely morning type (22–25), moderate morning type (18–21), neither type (12–17), moderate evening type (8–11) and definitely evening type (4–7)." |
| 第 1–4 题选项分 | 第 1、3、4 题五个选项记 5 到 1；第 2 题四个选项记 1 到 4 | Hwang H 等. J Korean Med Sci 2024;39:e257，doi:10.3346/jkms.2024.39.e257（CC BY-NC 4.0），表 1。 |
| 第 5 题选项分 | 6、4、2、0 | 同一张表印出前三个选项记 6、4、2；Danielsson 等 2019："The original scoring was used where the first four questions were scored 1–5 and question 5 was scored 0–6." |

Adan 和 Almirall 1991 是订阅文章，全文没有打开；上面的数字来自注明出处的开放获取论文。

## 两处不一致，以及为什么这样取

- Hwang 2024 表 1 把第 5 题最后一个选项印成 1，正文写总分 4–26；Danielsson 2019 写前四题都记 1–5，总分 4–26。可是第 2 题只有四个选项（Hwang 表 1 记 1–4），而多篇注明出自 Adan 和 Almirall 1991 的论文印的是 4–25，最高档是 22–25。
- 只有「第 1、3、4 题 1–5，第 2 题 1–4，第 5 题 0–6」这一组能同时得到最低 4 分和最高 25 分：1+1+1+1+0 = 4，5+4+5+5+6 = 25。所以这里第 2 题只收 1–4，第 5 题只收 0、2、4、6。

## 切点的局限

Danielsson 2019 引述："cutoff scores of the MEQ are affected by age, sex, cultural variations, season of birth, and puberty"。报告说明五档只是粗分。

## 核对

论文没有印出某个人的逐题示例。测试用印出的数字核对：最低 4、最高 25，每个分界两边（7/8、11/12、17/18、21/22）的分档；第 5 题填 3、第 2 题填 5、非整数、缺题、错单位都退出 3。

## 没有带过来的

VitaClaw 的 circadian-rhythm-optimizer 把第 5 题写成「23 点睡时的警觉高峰」，漏掉了 MEQ 第 10 题（晚上几点想睡），自评题记 6/4/2/0 虽对，但整份题目和 rMEQ 不一致。它的 DLMO ≈ 睡眠中点 − 7 小时估算、光照和进餐时间表、昼夜健康分都没有出处，都没有带过来。

## 题目原文

MEQ 的版权属于 Gordon and Breach（1976），rMEQ 用的是其中 5 题。仓库里只有题号、主题和每题可取的分值，没有题目和选项原文。
