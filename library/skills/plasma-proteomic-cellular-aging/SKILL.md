---
name: plasma-proteomic-cellular-aging
description: >-
  Writes a personal readout of the SomaScan cell-type aging clocks from Ding
  and colleagues, Nature Medicine 2026. Use when the user brings SomaScan
  protein z-scores, sex, medicines, or checkup labs and asks about these
  cellular aging clocks. The skill uses the published coefficient table. It
  does not turn a predicted cell age into advice to start or stop a medicine.
---

# 细胞类型蛋白年龄

用户交 SomaScan 蛋白数值、性别、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

报告列出对上足够实测蛋白的细胞类型和预测年龄。一个人的文件算不出年龄差。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

`--measurements` 用两列 `item,value`。性别用 `sex`，女为 1，男为 0。蛋白列名用系数表里的 aptamer 编号。
