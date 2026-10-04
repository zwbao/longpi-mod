---
name: naked-mole-queen-methylation-clock
description: >-
  Computes a naked mole-rat methylation age from Supplementary Table 20 of
  Horvath et al., Nature Aging 2022, when every weighted CpG beta is
  supplied. Use when the user mentions NMR queens, this methylation clock,
  or HorvathMammalMethylChip40 in naked mole-rats. Missing sites are not
  filled with zero. Queen status has no extra coefficient. Medicines and
  checkup labs stay context.
---

# 裸鼹鼠甲基化年龄

你交组织、各位点 beta、物种和年龄，也可以交现用药和体检。不要向用户要 GEO、PDF 或补充表。

组织对应的位点到齐时，按 Supplementary Table 20 的系数计算。缺位点不补 0。对数线性时钟按补充说明里的反函数，成熟年龄用代码片段里的 5 年。女王身份不另作加减。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 10 \
  --out out
```

`measurements.csv` 用 `name,value`。组织写 `tissue`，例如 `blood`。每个位点一行，名字是 cg 编号，值是 0 到 1 的 beta。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
