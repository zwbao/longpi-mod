---
name: lung-parenchyma-aging-clock
description: >-
  Writes a personal readout of the lung-parenchyma age residual defined in
  the Tsankov lab XGBoost code and Nature Communications 2026. Use when the
  user brings a predicted lung age, chronological age, medicines, or checkup
  labs. The skill does not invent the booster weights. It does not turn a
  residual into advice to start or stop a medicine.
---

# 肺实质年龄残差

用户交已经算好的肺预测年龄和实足年龄，以及现用药和体检。不要向用户要 GEO、STRING 或 PDF。

配套仓库里没有保存好的预测模型，所以不从基因表达重算年龄。报告只算实足年龄减预测年龄。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

`--measurements` 用两列 `item,value`，除非下面另说。方法说明见 [references/claims.md](references/claims.md)。
