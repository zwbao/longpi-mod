---
name: foxo3-osteoarthritis-ferroptosis
description: >-
  Matches gene names the user supplies to genes named by Zhao et al.,
  Nature Communications 2025 (doi:10.1038/s41467-025-59883-z) for
  obesity-related osteoarthritis, including FOXO3, TP53, and the ferroptosis
  suppressors they measured. Use when the user mentions this p53-FOXO3
  osteoarthritis paper. Does not invent a risk weight. Labs do not add genes.
---

# 肥胖骨关节炎里点名的基因

用户交基因名、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。报告开头是论文卡片。这篇论文没有可乘的系数。

对上的基因写入方法名单。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out/
```

`measurements.csv` 用两列 `name,value`。基因名用正文里的符号。方法说明见 [references/claims.md](references/claims.md)。
