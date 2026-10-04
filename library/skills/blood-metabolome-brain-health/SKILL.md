---
name: blood-metabolome-brain-health
description: >-
  Writes a personal readout of the fourteen cognition-linked blood metabolites from Ahmad et al., Nature Aging 2026. It keeps that published list and the three model-1 mean differences that are printed in the paper. Use when the user mentions this midlife blood metabolome, ergothioneine and cognition, or the Rotterdam Study metabolite signature. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 中年血液代谢与认知

你交代谢物数值。报告按十四个固定名字照录。你给了数值、论文又给了均数差时，均数差只写在这个数值旁边，不拿它乘。没有数值时，报告只列出名字。

不要向用户要 GEO 或 PDF。不要编造弹性网系数。现用药对不上时写「不能据此停」。体检不增删代谢物。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。

