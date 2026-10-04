---
name: mammal-cancer-risk-lifespan
description: >-
  Looks up a mammal species' published cancer mortality risk and, when both
  counts are supplied, divides neoplasia deaths by necropsies with a known
  cause, following Vincze et al., Nature 2022. Use when the user mentions
  cancer risk across mammals, Peto's paradox in zoo mammals, or this study.
  Body mass is not run through an unpublished coefficient vector. Medicines
  and checkup labs stay context.
---

# 哺乳动物癌症死亡比例

你交物种拉丁名，或肿瘤相关死亡数和有病理记录的死亡数，也可以交现用药和体检。不要向用户要 ZIMS、PDF 或补充表。

物种能对上时，报告数据表里的癌症死亡比例和累积癌症死亡。你自己的两列计数按论文的比例相除。不用体重去改这个比例。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

`measurements.csv` 用 `name,value`。物种写 `species`。计数写 `neoplasia` 和 `known_deaths`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
