---
name: proteomic-aging-clock
description: >-
  Writes a personal proteomic age gap. It subtracts chronological age from a supplied proteomic age and matches gene symbols to the published 204-protein names. Use when the user mentions ProtAge, ProtAgeGap, a proteomic aging clock, or the UK Biobank Olink clock. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 蛋白质年龄差

你交已经算好的蛋白质年龄、实足年龄、蛋白量、现用药和体检。报告先写蛋白质年龄减去实足年龄；补充表和公开仓库没有 LightGBM 系数时，不能从蛋白量重算蛋白质年龄。接着写对上的蛋白、现用药和体检。报告最后一行是固定边界，不能据此开始或停止任何药物。

不要向用户要 GEO、STRING、UK Biobank 或 PDF。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 50 \
  --out out
```

`--measurements` 可用两列 `item,value`。`protage` 是用户已经算好的蛋白质年龄。蛋白行用基因符号。`--age` 是实足年龄。`--medications` 每行一个药名。`--labs` 原样写入报告。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
