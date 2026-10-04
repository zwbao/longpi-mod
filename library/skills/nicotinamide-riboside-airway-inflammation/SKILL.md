---
name: nicotinamide-riboside-airway-inflammation
description: >-
  Computes one person's sputum interleukin-8 percent change from baseline to week 6, the primary outcome of the nicotinamide riboside airway trial in Norheim et al., Nature Aging 2024. It does not copy the trial's between-group estimate into the personal readout and does not recommend starting or stopping the supplement. Use when the user mentions this COPD airway trial, nicotinamide riboside, or sputum IL-8. Checkup labs stay context.
---

# 痰液白细胞介素的变化

你交痰液白细胞介素-8 的基线和第六周。两个数都有时，报告写出你自己的变化百分比。试验的组间估计留在方法说明里，不是处方。缺其中一个数时，报告说明没有算出变化。

不要向用户要 GEO 或 PDF。现用药对不上时写「不能据此停」。体检不增删结局。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 50 \
  --out out
```

数值用 ng/ml，字段名 `sputum_il8_baseline_ng_ml` 和 `sputum_il8_week6_ng_ml`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
