---
name: dissecting-genetic-proteomic-risk
description: >-
  Lists the 109 plasma proteins that passed the Bonferroni threshold in Figure
  5a of Raptis et al. 2026 and, when supplied, shows one person's protein
  levels and unphased APOE genotypes beside that fixed list. Use when the user
  mentions this delirium GWAS, deliriumGen, incident-delirium proteins, or
  APOE ε4 and delirium. Current medicines and checkup labs do not add or
  remove proteins. The report does not say what to start or stop. LASSO
  weights are not in the method repository and are not invented.
---

# 谵妄相关蛋白

用户交蛋白浓度、两个 APOE 位点的基因型、现用药和体检。不要向用户要 UK Biobank、Olink、GEO、STRING 或 PDF。蛋白名字已经在技能里。

没有浓度或基因型时，名单只有蛋白名字，没有个人数值。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --proteins PROTEINS.csv \
  --genotypes GENOTYPES.csv \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

`PROTEINS.csv` columns are `protein,value`. Values are shown next to symbols that are already on the Figure 5a list. A symbol that is not on that list is not added. `GENOTYPES.csv` columns are `rsid,genotype`, with genotypes such as `T/C`. ε4 count is reported only when the unphased genotypes determine it. `--medications` is one name per line. `--labs` is optional (`项目,结果,单位`).

The 18 stability-selected proteins and their regression coefficients are not in the cloned repository. Do not fill them in.

引用 `out/report.md`，包括 `边界:` 那一行。方法说明见 [references/claims.md](references/claims.md)。
