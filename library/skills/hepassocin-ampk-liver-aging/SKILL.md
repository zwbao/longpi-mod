---
name: hepassocin-ampk-liver-aging
description: >-
  Lists Hepassocin (HPS) → ANXA2-ERK-p90RSK-LKB1 → AMPK pathway claims from
  Yang et al., Signal Transduction and Targeted Therapy 2026, and separates
  mouse/human observational findings from what cannot be scored for one person.
  Use when the user mentions hepassocin, HPS/FGL1, liver senescence, or this
  STTT paper. Medicines and checkup labs do not edit the method list.
---

# 肝促泌素与肝衰老通路读出

用户交可选的 HPS/AMPK 标记、年龄、现用药和体检。不要向用户要 PDF、GEO 或补充表。已打开补充 docx（Tables S1–S3：患者信息、抗体、引物），没有个人 HPS 或肝再生分数的权重列。

报告按正文列出通路节点与小鼠发现。这不是个人肝龄预测，也不构成用药依据。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 70 \
  --out out
```

`measurements.csv` 用 `name,value`。可选键：`hps_level`、`ampk_activation`，取值用有或无。把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
