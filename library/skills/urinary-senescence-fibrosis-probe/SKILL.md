---
name: urinary-senescence-fibrosis-probe
description: >-
  Applies the published urine limit of detection, mean background plus three
  standard deviations, when an absorbance and a blank mean and standard
  deviation are supplied. It does not invent an MMP-7 concentration cutoff.
  Use when the user mentions the albumin gold-nanocluster urine probe, MMP-7
  senescence detection, or a urinary fibrosis readout. Medicines and checkup
  labs stay context. The report does not say what to start or stop.
---

# 尿液衰老探针

你交尿液吸光度、背景均值和背景标准差，以及可选的肽序列、现用药、体检、年龄。不要向用户要 GEO、STRING、PDF 或补充表。

报告开头是论文卡片。检出限按方法写成背景均值加三倍标准差。高于这条线才写入名单。只有吸光度、没有背景两列时不算。浓度没有界值列，不划线。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 50 \
  --out out
```

`--measurements` 用 `name,value`。合金测定用 `A414`，过氧化物酶测定用 `A652`。背景用 `背景均值` 和 `背景标准差`。`--medications` 一行一个名字。`--labs` 是 `项目,结果,单位`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
