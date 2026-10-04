---
name: hsc-inflammatory-memory
description: >-
  Lists supplied genes that fall in the HSC inflammatory-memory markers ranked
  by MarkerScore in Supplementary Table 9 of Zeng et al., Nature 2026. It does
  not compute the scanpy score or the modified Intermountain risk score. Use
  when the user mentions HSC inflammatory memory, HSC-iM, or this haematopoietic
  stem-cell paper. Current medicines and checkup labs stay context. The report
  does not say what to start or stop.
---

# 造血干细胞的炎症记忆

你交基因表达，以及可选的年龄、现用药和体检。对上补充表里炎症记忆基因的符号会写进名单。缺的基因不用 0 去补。不计算 scanpy 分数，也不计算改良风险分。

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

`--measurements` 用 `gene,value` 或 `name,value`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
