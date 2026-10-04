---
name: mtdna-cell-level-selection
description: >-
  Places one missense mtDNA heteroplasmy against the about-56-percent model
  cut and the about-60-percent lineage-dropout cut in Kotrys et al., Nature
  2024. Use when the user mentions SCI-LITE, cell-level mtDNA selection,
  m.11696G>A, or glucose versus galactose fitness. The inverse-sigmoid
  location, depth, and pitch are not refit. Medicines and checkup labs stay
  context. The report does not say what to start or stop.
---

# 细胞水平的线粒体选择

用户交错义或同义异质性、可选的 UMI、培养环境、现用药和体检。不要向用户要 FASTQ、GEO 或 PDF。

错义异质性对照正文的两个切点：模型大约百分之五十六，图 4 谱系脱落大约百分之六十。同义 m.11698C>T 没有清除切点。UMI 少于 64 时，不把该细胞算进膝点之后的单细胞。半乳糖、葡萄糖、低氧和常氧只附上正文写的方向。

反 S 形模型不重拟合。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out/
```

`measurements.csv` 用两列 `name,value`。异质性不超过 1 时视为分数，大于 1 时视为百分数。`--medications` 每行一个名字。`--labs` 是 `项目,结果,单位`。

方法说明见 [references/claims.md](references/claims.md)。
