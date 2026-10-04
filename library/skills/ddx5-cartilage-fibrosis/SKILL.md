---
name: ddx5-cartilage-fibrosis
description: >-
  Applies the published splicing and protein fold-change rules from the DDX5
  osteoarthritis paper to supplied delta PSI, FDR, and protein ratios. It does
  not invent gene weights. Use when the user mentions DDX5, hyaline cartilage
  fibrosis, or osteoarthritis splicing of fibronectin. Medicines and checkup
  labs stay context. The report does not say what to start or stop.
---

# 软骨纤维化解旋酶

你交基因的 delta PSI 和 FDR，或蛋白质比值和蛋白质 FDR，以及可选的现用药、体检、年龄。不要向用户要 GEO、STRING、PDF 或补充表。

报告开头是论文卡片。剪接用正文的两套规则分别判断。蛋白质用 1.2 倍和 FDR 规则。只有表达、没有这两列的基因不进入名单。图里没把符号写全的基因不编造。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

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

`--measurements` 用 `name,value`。剪接写成 `基因_delta_psi` 和 `基因_fdr`。蛋白质写成 `基因_ratio` 和 `基因_protein_fdr`。`--medications` 一行一个名字。`--labs` 是 `项目,结果,单位`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
