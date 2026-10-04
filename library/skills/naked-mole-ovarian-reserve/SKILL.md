---
name: naked-mole-ovarian-reserve
description: >-
  Estimates one naked mole-rat ovarian reserve from section counts using the
  correction factors in Brieño-Enríquez et al., Nature Communications 2023.
  Use when the user mentions postnatal oogenesis, NMR ovarian reserve, or
  this germ-cell counting method. Stages without a published factor are not
  filled in. Medicines and checkup labs stay context.
---

# 裸鼹鼠卵巢储备

你交日龄阶段、切片上的计数、所计切片数和总切片数，也可以交现用药和体检。不要向用户要 GEO、PDF 或补充表。

储备等于计数除以所计切片数，乘总切片数，再除以该日龄的校正因子。P15 没有校正因子，不算。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

`measurements.csv` 用 `name,value`。阶段写 `stage`，例如 `P8`。计数写 `raw_count`、`sections_counted`、`total_sections`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
