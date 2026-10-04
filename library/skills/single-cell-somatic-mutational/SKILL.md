---
name: single-cell-somatic-mutational
description: >-
  Writes a personal readout of chondrocyte somatic mutation burden from Ren et al., Nature Aging 2025. It applies that paper's coverage and sensitivity formula and keeps the published yearly slopes beside the result. Use when the user mentions somatic mutations in chondrocytes, osteoarthritis cartilage, or this single-cell whole-genome study. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 软骨细胞里的体细胞突变

你交每个细胞的突变计数、覆盖和灵敏度。合格细胞进入名单，并写出突变负担。细胞编号不是药。没有合格细胞时，报告说明没有算出负担。

不要向用户要 GEO 或 PDF。不要用年龄乘斜率去预测。现用药对不上时写「不能据此停」。体检不增删细胞。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。

