---
name: rapamycin-enterocyte-sex
description: >-
  Writes a personal readout of enterocyte size ratio and p62 over total protein from Regan et al., Nature Aging 2022, and records supplied enterocyte sex against that paper's autophagy direction. Use when the user mentions enterocyte sexual identity, transformer, Bchs, H3/H4, or sex differences in rapamycin autophagy. Fly and mouse doses are experimental. The report does not say what to start or stop.
---

# 肠细胞性别与雷帕霉素

你交对照和处理后的肠细胞面积、p62 和总蛋白，以及肠细胞性别。面积和蛋白都是正数时，报告写出比值。雌雄只用来照论文的方向写一句。

不要向用户要 GEO、STRING、PDF 或补充表。果蝇浓度和小鼠剂量是实验条件。现用药对不上时写「不能据此停」。体检不增删名单。

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

`measurements.csv` 用 `name,value`。面积用 `control_area` 和 `treated_area`。方法说明见 [references/claims.md](references/claims.md)。

