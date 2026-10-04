---
name: longitudinal-serum-proteome-mapping
description: >-
  Records serum proteins the user supplied when they match the named disease-associated proteins or the ageing-model accessions, and does not recompute the proteomic healthy ageing score. Use when the user mentions PHAS, the longitudinal serum proteome, GNHS ageing proteins, or this Nature Metabolism paper. Current medicines and checkup labs do not edit that list. The report does not say what to start or stop.
---

# 血清蛋白记录

用户交现用药、体检，以及可选的蛋白质数值。不要向用户要 GEO、STRING 或 PDF。

没有蛋白质数值时名单是空的，也不算健康衰老分数。对得上的数值记在名单上。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --out out/
```

可选 `--proteins proteins.csv`，列是 `名字,数值`。对上正文点名或年龄模型标识的才进入名单。IDAT 和 PDF 不读。

把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
