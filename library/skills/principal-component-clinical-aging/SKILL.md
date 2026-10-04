---
name: principal-component-clinical-aging
description: >-
  Computes the cotinine bins, 22-item comorbidity index, and self-health index printed in the Methods of Fong et al., the principal-component clinical aging clocks. Use when the user mentions PCAge, LinAge, CALinAge, or this NHANES clinical clock. LinAge years are not calculated, because Supplementary Table 7 weights are not in the main text. Current medicines and checkup labs do not edit the comorbidity list.
---

# 临床指数

用户交并存病、可替宁、自评健康、尿白蛋白肌酐比、现用药和体检。不要向用户要 NHANES、GEO、STRING 或 PDF。正文没有印出的岁数权重这里不算。

没有点到那二十二种并存病，就没有并存病指数。`huq050=` 照录就医使用指数的编码。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --measurements measures.txt \
  --out out
```

`measures.txt` 里一行一个字段，例如 `cotinine_ng_ml=10`、`comorbidity=高血压`、`fair_general_health=0`。没有这份文件时，名单为空，仍然出报告。

也可以用 `item,value,unit` 三列的表：并存病一行一种，有写 1、没有写 0；可替宁单位是 ng/mL（µg/L 相同）；尿白蛋白肌酐比单位是 mg/g，写 mg/mmol 会乘 8.84 换成 mg/g，名字不是 `acr_mg_g` 时必须写单位；自评健康四项写 1 或 0。`skill.json` 列出全部名字、单位和合理范围。单位不能换算、数值不在合理范围、读不出来或同一项写了两次且不同时不算：报告写明原因，脚本退出码 3。`out/result.json` 写出 `comorbidity_index`、`smoking_score`、`self_health_index` 和 `acr_at_least_30`。

引用 `out/report.md`，包括 `边界:` 那一行。
