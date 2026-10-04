---
name: platelet-factors-ageing-cognition
description: >-
  Records platelet factor 4 and the hippocampal and plasma markers named by
  Schroer et al., Nature 2023. It does not classify PF4 as high or low and does
  not compute a cognition score. Use when the user mentions platelet factor 4,
  CXCL4, or young platelet factors in ageing cognition. Current medicines and
  checkup labs stay context. The report does not say what to start or stop.
---

# 血小板因子与老年认知

你交血小板因子四和正文点名的炎症标志，以及可选的年龄、现用药和体检。对上的名字会写上论文里的方向。没有数值切点，也不配权重。

不要向用户要 GEO、STRING、PDF 或补充表。现用药对不上时写「不能据此停」。体检不增删方法算出的名单。

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

`--measurements` 用 `name,value`。可以用 PF4、CXCL4、Tnf、CCL2 这些正文里的名字。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
