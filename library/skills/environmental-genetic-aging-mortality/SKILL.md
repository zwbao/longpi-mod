---
name: environmental-genetic-aging-mortality
description: >-
  Annotates supplied exposome answers onto the eight exposures whose final cluster-model hazard-ratio bounds are stated in the UK Biobank exposome study. Use when the user mentions exposome aging, environmental architecture of mortality, or this Nature Medicine paper. Drug names stay off that exposure list. Checkup labs do not add or remove exposures. The report does not say what to start or stop.
---

# 暴露对照

用户交现用药、体检，以及可选的暴露回答。不要向用户要 GEO、STRING 或 PDF。

没有填写时名单是空的。填写了的暴露才进入名单。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --exposures exposures.csv \
  --out out/
```

`exposures.csv` 两列：`exposure,present`。`present` 为 yes 或 no。键名见 presets.py。可省略。

把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
