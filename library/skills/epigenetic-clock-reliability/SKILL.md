---
name: epigenetic-clock-reliability
description: >-
  Writes a personal readout of epigenetic-clock replicate disagreement from Higgins-Chen et al., Nature Aging 2022. It reports the absolute difference between two supplied clock ages and places it next to the published replicate deviations. Use when the user mentions PC clocks, epigenetic clock reliability, or technical replicates of DNA methylation age. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 两次甲基化年龄的差

你交同一个时钟的两个年龄。报告写出绝对差。有发表中位差的时钟，只在你的差旁边写那一个数。仓库没有主成分载荷，不算主成分年龄。没有成对年龄时，报告说明没有算出差。

不要向用户要 IDAT 或 PDF。现用药对不上时写「不能据此停」。体检不增删时钟。

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

