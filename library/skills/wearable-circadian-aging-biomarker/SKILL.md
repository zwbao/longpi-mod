---
name: wearable-circadian-aging-biomarker
description: >-
  Computes CosinorAge from MESOR, amplitude, acrophase, and chronological age using the pooled equation in Supplementary Table 1 of Shim et al. Use when the user mentions CosinorAge, wearable accelerometry, or this npj Digital Medicine study. Missing inputs are not filled with zero. Sex-specific inversion constants are not invented. Medicines and checkup labs do not edit the age.
---

# 可穿戴加速度的昼夜年龄

用户交 MESOR（毫克重力）、振幅（毫克重力）、峰相位（弧度，或钟点小时）和实足年龄，以及现用药和体检。不要向用户要 UK Biobank、STRING 或 PDF。

报告开头是论文卡片。四项都在时，按补充表 1 的全体模型计算 CosinorAge。缺一项不用 0 填。分性别的反演常数没有公布，不算分性别年龄。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --measurements measures.txt \
  --out out
```

`measures.txt` 可以是带表头 `item,value,unit` 的表，也可以每行写 `名称,数值`。名称用 `mesor`、`amplitude`、`acrophase_rad` 或 `acrophase_hour`，也认 MESOR、振幅、相位、峰时等写法；`skill.json` 列出全部名称、单位和合理范围。MESOR 和振幅按 mg（千分之一 g）读，单位列留空。弧度相位等于钟点小时 × 2π/24，在 0 到 2π 之间；钟点写小数小时，按分钟写时单位列写 min。弧度和钟点给一个就够。数值出了合理范围、单位不认识或不是数时不计算：报告写明原因，脚本退出码是 3。`out/result.json` 给出 `cosinorage` 和 `cosinorage_advance`。

引用 `out/report.md`，包括 `边界:` 那一行。

