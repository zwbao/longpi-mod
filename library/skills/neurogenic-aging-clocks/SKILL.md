---
name: neurogenic-aging-clocks
description: >-
  Compares one cell-type clock prediction with the published subventricular-zone
  aging-clock errors from Buckley and Sun et al., Nature Aging 2023. Use when
  the user mentions SVZ aging clocks, neurogenic rejuvenation, heterochronic
  parabiosis, or aNSC-NPC. Current medicines and checkup labs are context. The
  report does not say what to start or stop.
---

# 神经发生区细胞时钟

用户交细胞类型，以及可选的月龄和已经算好的预测月龄、现用药和体检。不要向用户要单细胞矩阵或回归系数。

报告只做预测月龄减实足月龄的绝对值。没有这两项时不算。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --cell-type aNSC-NPC \
  --age-months 21 \
  --predicted-months 16 \
  --medications meds.txt \
  --labs checkup.csv \
  --out out/
```

方法说明见 [references/claims.md](references/claims.md)。
