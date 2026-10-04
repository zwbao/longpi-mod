---
name: hemispheric-brain-age
description: >-
  Computes the laterality index (left minus right) divided by (left plus right)
  from Korbmacher et al., Nature Communications 2024. Use when the user mentions
  hemispheric brain age, brain asymmetry, or left and right MRI measures from
  that UK Biobank study. Current medicines and checkup labs are context. The
  report does not say what to start or stop.
---

# 半球侧化

用户交左右测量、现用药和体检。不要向用户要影像或 PDF。脑年龄的权重没有发表，这里不预测脑年龄。

报告只算（左减右）除以（左加右）。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --regions regions.csv \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

`regions.csv` 用三列 `name,left,right`。方法说明见 [references/claims.md](references/claims.md)。
