# IIEF-5：数值来源与合同

用户提供 5 道题的得分（每题 1–5）、性别，可选年龄和过去 6 个月是否尝试过性交。

技能自己带着计分规则、21 分切点和五档分档。不向用户要论文或别的问卷文件。

报告可以给出 5–25 的总分和发表的分档，21 分及以下时提示看男科或泌尿外科、同时做心血管风险评估。它不下诊断，不推荐药物，不说停药或换药。

## 来源

| 内容 | 取值 | 来源 |
| --- | --- | --- |
| 总分范围、切点、两端分档 | 5–25；21 分及以下为有勃起功能障碍；无（22–25）到重度（5–7） | Rosen RC 等. Int J Impot Res 1999;11(6):319–326，doi:10.1038/sj.ijir.3900472，摘要："Based on equal misclassification rates of ED and no ED, a cutoff score of 21 (range of scores, 5–25) discriminated best (sensitivity=0.98, specificity=0.88). ED was classified into five severity levels, ranging from none (22–25) through severe (5–7)." |
| 五档完整分界 | 重度 5–7，中度 8–11，轻到中度 12–16，轻度 17–21，无 22–25 | Rhoden EL 等. Int J Impot Res 2002;14:245–250，doi:10.1038/sj.ijir.3900859，摘要："The possible scores for the IIEF-5 range from 5 to 25, and ED was classified into five categories based on the scores: severe (5-7), moderate (8-11), mild to moderate (12-16), mild (17-21), and no ED (22-25)." |
| 回忆期、每题分值 | 过去 6 个月；每题 1–5 | de Donato G 等. Front Cardiovasc Med 2022，doi:10.3389/fcvm.2022.847519（CC BY 4.0），表 1 表头 "Over the past 6 months:"，每题选项记 1–5。题目原文没有抄进仓库。 |
| 看心血管的理由 | 勃起功能障碍常伴随无症状冠心病，间隔 2 到 5 年 | Nehra A 等（Princeton III 共识）. Mayo Clin Proc 2012;87(8):766–778，doi:10.1016/j.mayocp.2012.06.015（PMC3498391）："Erectile dysfunction commonly occurs in the presence of silent CAD, with a time window between ED onset and a CAD event of 2 to 5 years (class Ia)." |

Rosen 1999 是订阅文章，全文没有打开。摘要印出范围、切点和两端两档；中间三档的分界照 Rhoden 2002 摘要印出的同一分档，它和摘要里的两端完全一致。

## 适用范围

5–25 的范围意味着每题都答 1–5。完整版 IIEF 的第 2–5 题有 0 分（没有性活动、没有尝试性交），IIEF-5 的计分里没有。第 3–5 题问的是性交时的情况，所以问卷只适用于过去 6 个月尝试过性交的男性：填 0、`--attempted no` 或女性都不计算，报告说明原因，退出码 3。

## 核对

论文摘要没有印出某个人的逐题示例。测试用印出的数字核对：最低 5、最高 25，每个分界两边（7/8、11/12、16/17、21/22）的分档，0 分、女性、`--attempted no`、超范围、非整数、缺题、错单位都退出 3。

## 题目原文

IIEF 和 IIEF-5（SHIM）的版权属于 Pfizer，由 Mapi Research Trust 发放，未经许可不得复制、改写或翻译。仓库里只有题号和主题，没有题目和选项原文。
