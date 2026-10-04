---
name: ramanomics-senescence
description: >-
  Looks up user-supplied gene symbols in the published p21+ senescence DEG
  tables from Zhang et al., Nature Aging 2026 (RamanOmics), frozen from
  Supplementary Data MOESM4. Use when the user mentions RamanOmics, spatial
  Raman senescence, or this Nature Aging technical report. Raman spectra are
  not scored from user files. Medicines and labs do not edit hits.
---

# RamanOmics 衰老差异基因查表

用户交基因符号，以及可选年龄、现用药和体检。不要向用户要 Raman 原始图、SenNet 或补充 xlsx。技能自带从 MOESM4 `DEGs_Skin (sen)` / `DEGs_Lung (sen)` 冻结的 p21+ 老组织差异基因子集。

报告写出命中基因的组织上下文与 avg_log2FC。这不是个人组织衰老诊断，也不能从用户交的光谱重算 1131–1135 cm⁻¹ 脂质峰。现用药对不上时保留「不能据此停」。体检不增删查表命中。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements genes.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --out out
```

`genes.csv` 用 `name,value`（`symbol`/`gene`）或一列基因名。把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
