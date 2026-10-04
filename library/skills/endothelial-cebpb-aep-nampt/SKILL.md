---
name: endothelial-cebpb-aep-nampt
description: >-
  Lists the endothelial C/EBPβ/AEP → NAMPT cleavage → NAD+ pathway claims
  from Li et al., Science Advances 2026, and separates mouse genetic and
  pharmacological findings from what this skill cannot score for one person.
  Use when the user mentions endothelial C/EBPβ, AEP/legumain, NAMPT N136,
  vascular NAD depletion, or this Sci. Adv. paper. Medicines and checkup labs
  do not edit the method list. The report does not say what to start or stop.
---

# 内皮 C/EBPβ/AEP 与 NAMPT 通路读出

用户交可选的通路标记、年龄、现用药和体检。不要向用户要 GEO、ArrayExpress、PDF 或补充表。补充 PDF 里是小鼠衰弱评分、药代与试剂表，没有把个人 NAD+ 或血管年龄写成系数的权重列。

报告按正文列出通路节点、小鼠里加速衰老的干预、以及正文写明的遗传与药理缓解线索。这不是个人 NAD+ 预测，也不构成用药或停药依据。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 70 \
  --out out
```

`measurements.csv` 用 `name,value`。可选键：`endothelial_cebpb`、`endothelial_aep`、`nampt_cleavage`、`nad_level`，取值用有或无（或英文 present/absent）。缺了就写明缺哪一列，不另算分数。

把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
