---
name: immune-aging-clock-runx1
description: >-
  Writes a personal pAge, tAge, or TCRAge from Ping et al., Immunity 2026,
  using published Table S3 coefficients, and shows a paper card with the
  article, DOI, and Table S3 links. Use when the user mentions that Immunity
  study, immAge, an immune aging clock, or RUNX1 and T cell senescence.
  ptAge, immAge, and bulk-immAge are not scored. Medicines and checkup labs
  do not create a target list.
---

# 免疫衰老时钟

用户交实足年龄、性别、现用药、体检，以及一份测量表。不要向用户要 GEO、STRING、PDF、HRA 或 Table S3。系数在技能自带的 Table S3 冻结表里。

报告开头是论文卡片，含文章页、DOI、Table S3 和代码仓库链接，以及一段科普摘要。pAge 用原始细胞比例，tAge 用对数转换后的表达，TCRAge 用原始 TCR 指标，性别按女为 0、男为 1。缺任何一项就不算这个时钟，不用 0 去补。ptAge 和 immAge 缺训练集的缩放范围，bulk-immAge 的系数不在 Table S3，这三项不算。

现用药对不上时保留「不能据此停」。体检不增删方法算出的名单，也不改时钟。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --age 60 \
  --sex 女 \
  --measurements features.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

用户没有交的那一项就去掉对应参数。`--sex` 接受 `女`、`男`、`F`、`M`、`female`、`male`。

`features.csv` 的表头是 `clock,cell_type,feature,value`。`clock` 写 `pAge`、`tAge` 或 `TCRAge`。tAge 的 `cell_type` 用 Table S3 里的细胞类型，例如 `Th2`。pAge 和 TCRAge 的 `cell_type` 留空。tAge 的 `value` 已经是对数表达，技能不再取一次对数。PDF、IDAT 和其他读不了的格式会要求改交表格。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
