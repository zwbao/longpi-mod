---
name: biological-age-ct-cardiometabolic
description: >-
  Compares one person's abdominal CT cardiometabolic biomarkers with the
  published five-year survival medians from Pickhardt et al., Nature
  Communications 2025 (doi:10.1038/s41467-025-56741-w). Use when the user
  mentions CT biological age, CTBA, muscle density, aortic calcium, or this
  paper. The report ranks biomarkers by Table 1 IPA drop only when the value
  sits closer to the Table 2 died-within-five-years median. It does not
  estimate survival or say which medicine to start or stop.
---

# 腹部影像生物标志

用户交腹部影像测量、年龄、性别、现用药和体检。不要向用户要样条系数或 PDF。生存概率算不出来。

报告只把更靠近死亡中位数的标志按贡献从大到小排列。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements ct.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 55 \
  --out out/
```

`ct.csv` 用两列 `name,value`，并写上 `sex`。`--age` 用来选年龄段。方法说明见 [references/claims.md](references/claims.md)。
