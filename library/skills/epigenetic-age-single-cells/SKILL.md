---
name: epigenetic-age-single-cells
description: >-
  Profiles one cell's binary CpG methylation with the scAge likelihood from Trapp, Kerepesi, and Gladyshev, Nature Aging 2021. It uses the eight strongest liver reference rows and the repository age step of 0.1 month, not a new clock. Use when the user mentions scAge or single-cell epigenetic age. The age is in mouse months. Medicines and labs stay context.
---

# 单细胞甲基化月龄

你交指定位点上的甲基化，取值是 0 或 1。报告算出小鼠肝脏参照上的最大似然月龄。这些编号是位点，不是药。没有这些位点，报告说明没有算出月龄。

不要向用户要 GEO 或 PDF。不要另造斜率。现用药对不上时写「不能据此停」。体检不增删位点。

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

`--measurements` 用两列 `item,value`，item 是参照里的 ChrPos。甲基化只能是 0 或 1。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
