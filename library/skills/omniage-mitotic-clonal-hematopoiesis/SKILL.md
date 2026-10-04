---
name: omniage-mitotic-clonal-hematopoiesis
description: >-
  Computes the epiTOC2 total number of stem-cell divisions from CpG beta values using the formula and coefficients in Duzhaozhen/OmniAge. Use when the user mentions OmniAge, epiTOC2, mitotic age, or Du et al., Nature Communications 2026 (doi:10.1038/s41467-026-76038-w). Probes absent from the file or given as blank or NA are left out of the mean, as OmniAgePy's EpiTOC2 does (OmniAgeR instead stops on an NA). A beta outside 0 to 1, a probe listed twice, or a value that is not a number stops the run with exit code 3. The report does not assign a clonal-hematopoiesis probability, and checkup labs do not change the value.
---

# 干细胞分裂次数

用户交探针甲基化值、可选年龄、现用药和体检。不要向用户要原始测序或 PDF。

报告只按公式算出总干细胞分裂数。没有对上的探针时不算。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

`measurements.csv` 用两列 `name,value`，逗号或制表符分隔，表头可有可无，探针名以 cg 开头，不分大小写。空白或 NA 按缺失跳过，报告写明 163 个探针里用了几个。β 不在 0 到 1 之间（像百分比或 M 值）、同一探针出现两次、数值读不出，这次不算，退出码 3。`--age` 用来把总分裂数除以年龄，要大于 0。方法说明见 [references/claims.md](references/claims.md)。
