---
name: genetic-architecture-biological-age
description: >-
  Computes the biological age gap for nine organ systems as defined by Wen et
  al. 2024: support-vector predicted age minus chronological age, only when the
  user already supplies a predicted age. Use when the user mentions this paper,
  organ biological age gap, or the nine-organ GWAS. The skill does not fit the
  support-vector model and does not invent weights. Current medicines and
  checkup labs do not add or remove organs. The report does not say what to
  start or stop.
---

# 器官年龄差

用户交各器官已经算好的预测年龄、实足年龄、现用药和体检。不要向用户要 UK Biobank、影像特征、GEO、STRING 或 PDF。这里不拟合模型，也不编造权重。

没有预测年龄就没有年龄差。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --predicted PREDICTED.csv \
  --age AGE \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

`PREDICTED.csv` columns are `organ,predicted_age`. Organ names are brain, cardiovascular, eye, hepatic, immune, metabolic, musculoskeletal, pulmonary, and renal. An unknown name is not added. Without `--age`, a predicted age is shown and the gap is not computed.

`--medications` is one name per line. `--labs` is optional (`项目,结果,单位`). IDAT and PDF files are not read.

引用 `out/report.md`，包括 `边界:` 那一行。方法说明见 [references/claims.md](references/claims.md)。
