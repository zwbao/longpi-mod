---
name: accelerated-biological-aging-risk
description: >-
  Computes one person's phenotypic age and its difference from chronological
  age from nine blood chemistries, using the Levine 2018 PhenoAge coefficients
  in the BioAge package (orig=TRUE). The paper card cites that calculator.
  Gao et al. 2023 uses phenotypic age for depression and anxiety and does not
  publish these coefficients; its questionnaire, body-mass, alcohol, activity,
  systolic-pressure, and childhood-adversity cutoffs apply only when those
  measurements are supplied. States that KDM biological age and the cohort
  residual acceleration are not computed. Use when the user mentions KDM-BA,
  PhenoAge acceleration, or biological age with depression and anxiety in UK
  Biobank. Current medicines and checkup labs do not change the biomarker list
  or the phenotypic age. The report does not say what to start or stop.
---

# 表型年龄

用户交九项血液指标和实足年龄，可选问卷、体重、饮酒、活动、收缩压、童年逆境、现用药和体检。不要向用户要 NHANES、GEO、STRING 或 PDF。系数已经在技能里。

九项不齐就没有表型年龄。可选切点只在对应测量给齐时计算，不改表型年龄。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --biomarkers BIOMARKERS.csv \
  --age AGE \
  --sex SEX \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --phq4 PHQ4.txt \
  --bmi BMI \
  --height-m METERS \
  --weight-kg KG \
  --alcohol-g GRAMS \
  --moderate-min MIN \
  --vigorous-min MIN \
  --mixed-min MIN \
  --sbp MMHG \
  --phq9 PHQ9.txt \
  --gad7 GAD7.txt \
  --childhood CTS.txt \
  --out out/
```

`BIOMARKERS.csv` columns are `marker,value,unit`; the unit column may be empty only when the marker is named by its key (the key carries the unit). Required markers, in the units of `phenoage_calc.R`: `albumin_gL` (g/L), `creat_umol` (µmol/L), `glucose_mmol` (mmol/L), `crp_mg_dl` (mg/dL), `lymph_pct`, `mcv_fl`, `rdw_pct`, `alp_u_l`, `wbc_10e3` (10^3/µL). A missing marker means no phenotypic age. Do not fill it from the checkup file. Markers may also be named as on a Chinese lab report (白蛋白, 肌酐, 葡萄糖, 超敏C反应蛋白, 淋巴细胞百分比, 平均红细胞体积, RDW-CV, 碱性磷酸酶, 白细胞计数); `skill.json` lists every accepted name, unit and range. Declared units are converted (g/dL, mg/dL, mg/L, ×10⁹/L). CRP named that way must state its unit, because mg/L read as mg/dL stays in range and shifts the age by years. A value outside its range, an unknown unit, or RDW-SD instead of RDW-CV stops the computation: the report lists why and the script exits 3. `out/result.json` holds `phenoage` and `phenoage_advance`.

`--sex` is not an input to the phenotypic-age formula. It is used for the alcohol cutoff. `--phq4` is four numbers (data-fields 2050, 2060, 2070, 2080). `--phq9` is nine numbers and `--gad7` is seven numbers, in the paper's item order. `--childhood` is five answers (never, rarely, sometimes, often, very often) for data-fields 20487, 20488, 20489, 20490, 20491. Body mass index uses `--bmi`, or weight divided by height squared when both `--weight-kg` and `--height-m` are set. Activity needs all three minute counts. `--medications` is one name per line. `--labs` is optional (`项目,结果,单位`).

IDAT and PDF files are not read.

引用 `out/report.md`，包括 `边界:` 那一行。方法说明见 [references/claims.md](references/claims.md)。
