---
name: blood-based-dna-damage
description: >-
  Writes a personal readout of the blood DNA-damage length bias from Sproviero et al., Nature Aging 2025. It applies that paper's fold-change and adjusted-P cutoffs and compares median length of up- versus down-regulated genes. Use when the user mentions this Parkinson's DNA damage signature, ALBATRO, longer-transcript suppression, or PPMI visit 1 versus visit 8. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 血液转录本的长度偏倚

你交基因的倍数变化、校正显著性和长度。过了门槛的基因进入名单，报告比较上调和下调哪一侧更长。这些是基因符号，不是药。没有基因过门槛时，报告说明没有比较长度。

不要向用户要 GEO 或 PDF。不要另造权重。现用药对不上时写「不能据此停」。体检不增删基因。

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
