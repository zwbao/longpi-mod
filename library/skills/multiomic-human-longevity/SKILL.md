---
name: multiomic-human-longevity
description: >-
  Matches gene names the user supplies to the high-confidence TWAS genes in
  Table 1 and the colocalized drug-target genes in Table 2 of Mavromatis et
  al., Nature Communications 2023 (doi:10.1038/s41467-023-37729-w). Use when
  the user mentions this multi-omic epigenetic aging study, TPMT, NHLRC1, or
  the multivariate longevity genes in that paper. Does not multiply TWAS Z or
  MR beta into a personal score. Labs do not add genes.
---

# 多组学表观年龄里点名的基因

用户交基因名、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。报告开头是论文卡片。正文表 1 和表 2 的正负号只用来说明方向，不算个人分数。

对上的基因写入方法名单。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

`measurements.csv` 用两列 `name,value`。基因名用正文里的符号。方法说明见 [references/claims.md](references/claims.md)。
