---
name: mitophagy-inducers-alzheimers
description: >-
  Lists the eight mitophagy-inducing compounds named in Xie et al., Nature Biomedical Engineering 2022, and says which of them also worked in nematode neurons or memory assays. It does not compute the Mol2vec similarity, because the published supplement has pairwise scores among library IDs and no name column or reference vectors. Use when the user mentions this cross-species mitophagy screen, kaempferol, rhapontigenin, or the Macau Library hits. Experimental concentrations are not personal doses.
---

# 线粒体自噬诱导物的名单

名单是正文写出名字、并在细胞里诱导线粒体自噬的八个化合物。山奈酚和丹叶大黄素还进入了动物的记忆实验。相似度需要诱导物向量，补充表里没有这一列，所以不算。实验浓度不写成用法。

不要向用户要 GEO、STRING、PDF 或补充表。现用药对不上时写「不能据此停」。体检不增删这八个名字。

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

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
