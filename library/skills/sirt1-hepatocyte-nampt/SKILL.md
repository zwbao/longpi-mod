---
name: sirt1-hepatocyte-nampt
description: >-
  Lists the hepatocyte NAMPT effects that Higgins et al., Nature
  Communications 2022, assign to SIRT1 and the effects they say do not require
  SIRT1. It does not predict glucose, lipids, or FGF21 for one person. Use
  when the user mentions hepatocyte NAMPT, hepatic SIRT1, or this fasting
  metabolism paper. Medicines and checkup labs do not edit the method list.
  The report does not say what to start or stop.
---

# 肝细胞烟酰胺磷酸核糖转移酶的两类效应

用户交可选的肝细胞 SIRT1 有无、年龄、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。

报告按正文列出两类效应：SIRT1 缺失会反过来的，以及不依赖 SIRT1 的。有无这一列只说明你标了哪一种，不另算分数。缺了就写明缺 hepatocyte_sirt1。血糖、血脂和 FGF21 没有系数列，不算预测。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 70 \
  --out out
```

`measurements.csv` 用 `name,value`。肝细胞 SIRT1 放在 `hepatocyte_sirt1`，取值用有或无。

把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
