---
name: polygenic-gut-metagenomic-risk
description: >-
  Reads one person's age, polygenic score, and gut-microbiome score against the clinical factors used for coronary disease, type 2 diabetes, Alzheimer disease, or prostate cancer in Liu et al., Nature Aging 2024. It does not turn those inputs into a personal probability, because the Cox coefficients are not in the paper or the script. Use when the user mentions integrated polygenic and gut microbiome risk for these diseases. Labs do not add factors.
---

# 多基因与肠道菌群

你交病种，以及可选的年龄、多基因分数、菌群分数和常规因素。报告照录你交来的数。回归系数不在已读材料里，所以不算发病概率。没有病种时，报告说明没有对上。

不要向用户要队列文件或 PDF。不要另造回归系数。现用药对不上时写「不能据此停」。体检不增删因素。

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

`disease` 用 cad、t2d、ad 或 prostate。`prs` 和 `microbiome_score` 是已经算好的分数。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
