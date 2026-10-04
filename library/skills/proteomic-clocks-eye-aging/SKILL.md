---
name: proteomic-clocks-eye-aging
description: >-
  Records ProAge or cProAge predictions a person already has, using the eye-aging proteomic clocks in Yang et al., npj Digital Medicine 2026 (DOI 10.1038/s41746-026-02805-0). Use when the user brings a proteomic age and asks about eye aging, AREDs, ProAge, or cProAge. Acceleration is the residual from regressing chronological age on proteomic age, and those regression coefficients are not printed, so this skill does not compute it.
---

# 眼衰老蛋白时钟

用户交已经算好的 ProAge 或 cProAge、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

报告记下预测年龄。加速年龄是实际年龄对蛋白年龄回归后的残差，系数没有印出，所以不算。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements MEASUREMENTS.csv \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

`MEASUREMENTS.csv` needs columns `clock` and `predicted_age`. Accepted clocks are ProAge and cProAge.

`--medications` is optional, one name per line. `--labs` is optional. Abnormal checkup rows are printed and do not add or remove names from the method list. A medicine that is not on that list keeps the sentence 不能据此停.

## Report

Copy `out/report.md`, including its final `边界:` line. The report may show the supplied predicted ages. Published MAEs stay in [references/claims.md](references/claims.md). It may not give ProAgeAccel.

Method notes: [references/contract.md](references/contract.md), [references/claims.md](references/claims.md). The command is also in [examples.md](examples.md).
