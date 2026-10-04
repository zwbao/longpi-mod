---
name: divergent-white-matter-metabolic
description: >-
  Writes a personal readout of the expected-minus-atypical white-matter FDG difference from Zhang et al., Nature Communications 2026. It subtracts the two supplied SUVR values using that paper's definition. Use when the user mentions divergent white-matter metabolism, EWM, AWM, or this FDG signature of cognitive decline. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 白质葡萄糖代谢的差值

你交预期白质和非典型白质的 SUVR。两个都有时，报告用前者减去后者。缺一个时，报告说明没有算出差值。差值不是认知诊断。

不要向用户要影像或 PDF。不要另造回归权重。现用药对不上时写「不能据此停」。体检不增删这两个区域。

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

