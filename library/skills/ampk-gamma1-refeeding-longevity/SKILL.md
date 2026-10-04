---
name: ampk-gamma1-refeeding-longevity
description: >-
  Computes the multidimensional prognostic index as the sum of eight supplied
  domain points divided by eight, using the bins in Ripa et al., Nature Aging
  2023. It does not turn a PRKAG1 expression value into that index, because the
  paper does not print the slope or intercept. Use when the user mentions AMPK
  gamma1, PRKAG1, refeeding, or this killifish longevity paper. Medicines and
  checkup labs do not edit the method list. The report does not say what to
  start or stop.
---

# 再喂食时的调节亚基与预后指数

用户交八个分项的点数、可选的 PRKAG1 表达、年龄、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。

八个点数到齐时，报告把它们相加再除以八，并按方法段的三档命名。缺一个点就写明缺哪一项，不填零。表达量不换成指数，因为没有斜率和截距。图上的原始分档没有配上点数，原始分不算。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 70 \
  --out out
```

`measurements.csv` 用 `name,value,unit` 三列，只有 `name,value` 两列也行。八个点的名字是 `adl`、`iadl`、`spmsq`、`cirs_ci`、`mna_sf`、`ess`、`nm`、`social`，也认各项的中文名；每个点在 0 到 1 之间，单位列留空或写 `score`。原始量表分写成 `adl_raw` 或 `……原始分`，只记下。`prkag1` 可以另给，只照录。`skill.json` 列出全部名字、单位和范围。缺一项、点数不在 0 到 1 之间、单位不对或读不出来时不算指数：报告写明原因，脚本退出码 3。`out/result.json` 写出 `mpi` 和 `mpi_group`。

把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
