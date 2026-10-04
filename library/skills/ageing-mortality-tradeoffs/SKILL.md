---
name: ageing-mortality-tradeoffs
description: >-
  Labels a supplied Vita or Soma locus with the effect class printed for
  that locus in the mouse actuarial-mapping paper. Use when the user
  mentions UM-HET3, Vita loci, Soma loci, or genetic trade-offs in ageing
  and mortality. No intercept converts a genotype into a death probability.
  Medicines and checkup labs do not add loci.
---

# 寿命位点类型

用户交位点名、现用药和体检。有日龄时加 `--age`。不要向用户要 GEO、STRING、PDF 或补充表。

位点对上表二或补充表四时，报告写下论文里的类型。这不是死亡概率。补充表没有把基因型写成死亡概率的截距列。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 400 \
  --out out
```

`--measurements` 用 `name,value`。位点写在 `locus` 后面，例如 `locus,Vita1a`。`--age` 是日龄，不参与概率。`--medications` 一行一个名字。`--labs` 是 `项目,结果,单位`。把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
