---
name: muscle-regeneration-somatic-mutation
description: >-
  Matches a supplied gene name to the bold muscle-related rows in
  Supplementary Table 1 of Vrtačnik, Merino et al., Nature Aging 2025. Use
  when the user mentions somatic mutations during skeletal muscle
  regeneration, Rpsa, Npm1, or grip strength after repeated injury. The
  match is the mouse table, not the person's sequencing. Grip strength is
  not computed because the body-weight equation is missing.
---

# 再生中的体细胞突变

用户交基因名、现用药、体检，以及可选的年龄。不要向用户要 GEO、STRING、PDF 或补充表。

报告开头是论文卡片。加粗的基因按 Supplementary Table 1 对照，并写明这不是这个人的测序。握力缺体重归一化的式子。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out/
```

`measurements.csv` 用 `name,value`，或一行一个基因名。引用 `out/report.md`，包括最后一行 `边界:`。
