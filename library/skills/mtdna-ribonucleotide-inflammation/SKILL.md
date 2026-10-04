---
name: mtdna-ribonucleotide-inflammation
description: >-
  Matches one person's gene names to the interferon-stimulated genes printed
  on the heatmaps in Bahat et al., Nature 2025. Use when the user mentions
  ribonucleotides in mtDNA, MGME1, YME1L, or cGAS-STING senescence. It does
  not invent an expression weight or a nucleotide-ratio cutoff. Medicines
  and checkup labs stay context. The report does not say what to start or stop.
---

# 线粒体核糖核苷酸与炎症

用户交基因名和可选的核苷酸比值、现用药和体检。不要向用户要 INTERFEROME、PRIDE、GEO 或 PDF。

只有正文热图上印出的干扰素刺激基因进入名单，数值照录，没有权重。核糖核苷酸与脱氧核糖核苷酸的比值没有个人切点。z 分数缺 log2 强度的均值和标准差。

现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out/
```

`measurements.csv` 用两列 `name,value`。`--medications` 每行一个名字。`--labs` 是 `项目,结果,单位`。

方法说明见 [references/claims.md](references/claims.md)。
