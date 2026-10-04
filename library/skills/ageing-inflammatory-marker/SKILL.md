---
name: ageing-inflammatory-marker
description: >-
  Lists MCU, MICU1, and the whole-blood inflammatory genes named in Fig. 1 of
  Seegren et al., Nature Aging 2023. It does not fit an age regression and does
  not invent slopes or intercepts. Use when the user mentions inflammaging, MCU,
  MICU1, or this macrophage calcium paper. Current medicines and checkup labs
  stay context. The report does not say what to start or stop.
---

# 衰老相关的炎症标志

你交基因表达，以及可选的年龄、现用药和体检。对上图一的炎症基因，以及 MCU 和 MICU1，会写上论文里的方向。没有斜率，也不配权重。

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

`--measurements` 用 `name,value`。有年龄时写 `--age`。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
