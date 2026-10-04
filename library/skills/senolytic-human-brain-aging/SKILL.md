---
name: senolytic-human-brain-aging
description: >-
  Writes a personal gene-ranking score, negative P times the sign of log fold change, from Aguado et al., Nature Aging 2023. Use when the user mentions senolytics in human brain organoids, navitoclax, ABT-737, dasatinib plus quercetin, or senolytic treatment of COVID neuropathology in organoids. Transcriptomic age is not computed because this paper has no clock-weight column. The report does not say what to start or stop.
---

# 衰老细胞清除与脑类器官

你交基因名、P 值和 logfc。两列都有时，报告写出排序分。转录组年龄不算，因为这篇没有位点权重列。

不要向用户要 GEO、STRING、PDF 或补充表。类器官和小鼠的浓度是实验条件。现用药对不上时写「不能据此停」。体检不增删名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out
```

`measurements.csv` 可以用 `gene,p,logfc`，也可以用 `name,value`。方法说明见 [references/claims.md](references/claims.md)。

