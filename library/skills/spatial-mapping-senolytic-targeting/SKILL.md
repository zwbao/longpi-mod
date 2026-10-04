---
name: spatial-mapping-senolytic-targeting
description: >-
  Writes a personal readout of senescent and disease-associated microglia markers from Carver et al., Nature Aging 2026. It computes a log2 ratio between supplied GAL3-positive and GAL3-negative expression for the genes named in that paper. Use when the user mentions SenBrain, GAL3 microglia, white-matter senolytics, venetoclax, or AP20187 in aged brain. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 白质里的衰老小胶质细胞

你交 GAL3 阳性和阴性细胞的表达。成对且为正数时，报告写出 log2 倍数。维奈克拉和 AP20187 的剂量是论文里小鼠实验的结果，不是给人的用法。没有成对表达时，报告说明没有算出倍数。

不要向用户要 GEO 或 PDF。不要把小鼠剂量写成给人的用法。现用药对不上时写「不能据此停」。体检不增删名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。

