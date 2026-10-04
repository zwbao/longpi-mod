---
name: muscle-chaperone-autophagy
description: >-
  Records that a personal chaperone-mediated autophagy score is not computed
  for skeletal muscle. Supplementary Fig. 1 names the network genes and does
  not give the weight or direction column used in the Methods. Use when the
  user mentions CMA, LAMP2A, HSC70, or this Nature Metabolism muscle myopathy
  paper. Medicines and checkup labs do not create a score. The report does
  not say what to start or stop.
---

# 骨骼肌分子伴侣自噬

用户交测量、现用药、体检，以及可选的年龄。不要向用户要 GEO、STRING、PDF 或补充表。

报告开头是论文卡片。方法写每个网络组分的权重是 1 或 2、方向是正或负，补充图只列出基因名，所以这次不算分数。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out/
```

`measurements.csv` 用 `name,value`，或一行一个论文里的项目名。`--medications` 一行一个名字。`--labs` 是 `项目,结果,单位`。引用 `out/report.md`，包括最后一行 `边界:`。
