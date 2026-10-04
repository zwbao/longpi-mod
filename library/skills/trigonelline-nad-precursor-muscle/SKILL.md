---
name: trigonelline-nad-precursor-muscle
description: >-
  Records a supplied serum trigonelline value and does not convert the myotube EC50 or the mouse dose into a personal dose. Use when the user mentions trigonelline, sarcopenia, NAD precursors, or this Nature Metabolism paper. A missing medicine is not a reason to stop it. Labs do not edit the recorded value. The report does not say what to start or stop.
---

# 葫芦巴碱记录

用户交现用药、体检，以及可选的血清葫芦巴碱。不要向用户要 GEO、STRING 或 PDF。

没有血清数值时名单是空的。有数值时只记下这个数，正文没有血清分界，所以不分档。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --trigonelline 1.0 \
  --out out/
```

`--trigonelline` 是用户自己的血清数值，单位沿用用户表里的写法，技能不另设界值。

把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
