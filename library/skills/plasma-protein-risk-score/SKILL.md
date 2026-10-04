---
name: plasma-protein-risk-score
description: >-
  Writes a personal hip-fracture plasma protein risk score from published
  Cox, LASSO, and elastic-net betas, and heel-ultrasound bone density when
  both ultrasound readings are supplied. Use when the user brings
  per-standard-deviation plasma proteins, heel ultrasound, medicines, or
  checkup labs and asks about this hip-fracture protein score. The skill
  does not ask for a reference cohort. It does not turn the score into
  advice to start or stop a medicine.
---

# 髋部骨折蛋白读出

用户交自己的蛋白表、可选的足跟超声 BUA 和 SOS、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

给了按标准差计的蛋白时，用已发表的加权、套索和弹性网系数算风险分，没测到的蛋白按 0 代入。给了 BUA 和 SOS 时，按印出的式子算超声骨密度。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

`--measurements` 用两列 `item,value`。超声用 `bua` 和 `sos`。蛋白行可以带 `deprecated`、`nonhuman` 或 `poor_quality` 标记（值为 1 则按方法排除）。`--medications` 每行一个药名。`--labs` 原样写入报告。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
