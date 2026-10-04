---
name: circadian-caloric-restriction-longevity
description: >-
  Matches a 30 percent calorie cut, feeding phase, and feeding window to one arm in Acosta-Rodríguez et al. Use when the user mentions circadian alignment of caloric restriction in male C57BL/6J mice or this Science study. Mouse median lifespans are not written as a human lifespan. Medicines and checkup labs do not edit the arm name.
---

# 限食时刻与寿命

用户交热量限制百分比、进食相位和进食窗口小时，以及现用药和体检。不要向用户要 GEO、STRING 或 PDF。

报告开头是论文卡片。记录对上正文六组里的哪一组。各组小鼠的中位寿命不写成这个人的寿命。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

