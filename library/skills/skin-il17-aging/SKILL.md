---
name: skin-il17-aging
description: >-
  Places a mouse age in weeks against the adult, aged, and neutralization windows, and lists Il17a, Il17f, Il17ra, and Il17rc from Solá et al. Use when the user mentions lymphoid IL-17 signaling and skin aging or this Nature Aging study. Expression is not turned into a skin-age score. Medicines and checkup labs do not edit the gene list.
---

# 淋巴来源白介素与皮肤老化

用户交小鼠周龄、四个白介素相关基因的测量、现用药和体检。人的实足年龄不换算成小鼠周龄。不要向用户要 GEO、STRING 或 PDF。

报告开头是论文卡片。周龄只对照正文写下的窗口。基因测量照录，没有系数就不判高低。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --measurements measures.txt \
  --out out
```

引用 `out/report.md`，包括 `边界:` 那一行。

