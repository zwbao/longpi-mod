---
name: omicmage-biological-age-multiomics
description: >-
  Matches one person's assay names to the OMICmAge features retained in Figure 4 of Chen et al., Nature Aging 2026 (doi:10.1038/s43587-026-01073-7), and counts the All of Us inputs named for rebuilding EMRAge. Use when the user mentions OMICmAge, EMRAge, or DNAmEMRAge. Supplementary Table 3 coefficients are not in the PDF or the GitHub scripts, so the report does not print a personal age. Medicines and checkup labs do not edit that feature list.
---

# 多组学保留特征

用户交自己测到的项目和数值、现用药和体检。不要向用户要系数表或 PDF。个人生物年龄算不出来。

报告只核对哪些项目落在论文保留下来的特征里。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out/
```

`measurements.csv` 用两列 `name,value`。方法说明见 [references/claims.md](references/claims.md)。
