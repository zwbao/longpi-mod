---
name: stochastic-epigenetic-aging
description: >-
  Computes the paper's RR2 ratio and CpG switch probability for the stochastic
  component of epigenetic clocks. Use when the user mentions stochastic
  epigenetic aging, Tong, Teschendorff, Nature Aging 2024, or what fraction of
  Horvath, Zhang, or PhenoAge could be stochastic. Current medicines and
  checkup labs are context. The report does not say what to start or stop.
---

# 表观遗传随机成分

用户可以交时钟名字、两个决定系数、一个效应大小、现用药和体检。不要向用户要二十五个队列或参考矩阵。

报告只做两个决定系数的除法，以及论文公式下的位点切换概率。没有这两个数时不算比例。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --clock Horvath \
  --r2-stochastic 0.50 \
  --r2-clock 0.80 \
  --effect-size 0.05 \
  --medications meds.txt \
  --labs checkup.csv \
  --out out/
```

方法说明见 [references/claims.md](references/claims.md)。
