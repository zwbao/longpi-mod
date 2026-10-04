---
name: sex-specific-immune-aging
description: >-
  States that one person's sex-stratified PBMC single-cell age is not computed.
  The supplement is a PDF, and the GitHub and Zenodo archives do not save the
  multilayer perceptron. Use when the user mentions sex-specific nonlinear
  immune aging, sex-aware aging features, or a PBMC single-cell aging clock.
  Current medicines and checkup labs do not create a method list. The report
  does not say what to start or stop.
---

# 单细胞免疫衰老轨迹

用户可以交外周血单个核细胞单细胞表达、性别、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

报告开头是论文卡片。补充材料是说明文件，不是权重表。仓库和 Zenodo 压缩包也没有保存多层感知机，这次不算预测年龄。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements MEAS.csv \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

`MEAS.csv` columns are `name,value`. Values are echoed and not scored. `--medications` is one name per line. `--labs` is optional (`项目,结果,单位`). IDAT and PDF files are not read.

引用 `out/report.md`，包括 `边界:` 那一行。方法说明见 [references/claims.md](references/claims.md)。
