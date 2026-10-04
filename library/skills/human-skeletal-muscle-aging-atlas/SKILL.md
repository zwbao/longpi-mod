---
name: human-skeletal-muscle-aging-atlas
description: >-
  Lists which skeletal-muscle cell states from Kedlian et al., Nature Aging
  2024, the user named, and attaches the age direction written in the main
  text. Use when the user mentions the human skeletal muscle aging atlas,
  TNF-positive muscle stem cells, ICAM1-positive muscle stem cells, or
  fast-twitch fiber loss. Supplementary Table 3 has cohort log2fc and no
  intercept, so no personal score is printed. Labs do not add names.
---

# 人类骨骼肌衰老图谱

用户交点到的细胞或纤维名字、现用药、体检，以及可选的年龄。不要向用户要 GEO、STRING、PDF 或补充表。

报告开头是论文卡片。Supplementary Table 3 有队列的 log2fc，没有截距，所以不算个人分数。只对你点到的、正文写了方向的名字作附注。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out/
```

`measurements.csv` 用 `name,value`，或一行一个论文里的项目名。引用 `out/report.md`，包括最后一行 `边界:`。
