---
name: mci-cognitive-signatures
description: >-
  Says that no personal cognitive-domain score is computed because the cloned CVAE weight repository is empty. Use when the user mentions CVAE-MCI, BABRI, MCI-specific atrophy, or this npj Digital Medicine paper. Medicines and checkup labs do not create a domain list. The report does not say what to start or stop.
---

# 认知域读出

用户交现用药和体检。不要向用户要 GEO、STRING 或 PDF。

仓库里没有模型权重，这次不算个人分数，名单是空的。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --out out/
```

把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
