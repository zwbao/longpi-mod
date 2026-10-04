---
name: cilia-autophagy-cognitive-resilience
description: >-
  Lists the primary-cilium and autophagy proteins named in Rivagorda et al., Nature Aging 2025, including GPR158, IFT20, IFT88, KIF3A and osteocalcin. It does not convert cilium length or osteocalcin into a cognitive score, because that coefficient column is not in the paper. Use when the user mentions this hippocampal cilia-autophagy axis or GPR158. Experimental treatments are not personal doses.
---

# 海马神经元的纤毛与自噬

名单是正文点名的纤毛–自噬轴成员。你交纤毛长度时，报告照录这个数，不把它换成认知分数，因为没有系数列。动物实验不写成用法。

不要向用户要 GEO、STRING、PDF 或补充表。现用药对不上时写「不能据此停」。体检不增删名单。

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

纤毛长度字段名 `cilia_length_um`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
