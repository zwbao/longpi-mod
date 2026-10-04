---
name: cgas-sting-ageing-inflammation
description: >-
  Applies the Extended Data Fig. 10d gene cutoff from Gulen et al., Nature 2023,
  to one supplied gene table: adjusted P at most 0.05 and log2 fold change at
  least 0.3. It does not turn mouse fold changes into a personal cGAS-STING
  score. Use when the user mentions cGAS, STING, H-151, or this ageing-related
  inflammation paper. Current medicines and checkup labs stay context. The
  report does not say what to start or stop.
---

# 胞质核酸感受与老年炎症

你交一张基因表，以及可选的年龄、现用药和体检。表里同时有基因、`avg_log2FC` 和 `p_val_adj` 时，报告按扩展数据图十的门槛列出基因。没有这两列时，报告写明缺列。不要把小鼠倍数当成权重。

不要向用户要 GEO、STRING、PDF 或补充表。现用药对不上时写「不能据此停」。体检不增删方法算出的名单。

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

`--measurements` 用 `gene,avg_log2FC,p_val_adj`。`--medications` 一行一个名字。`--labs` 是 `项目,结果,单位`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
