---
name: calerie-methylation-clocks
description: >-
  Places one person's DunedinPACE, PC PhenoAge, and PC GrimAge values next to
  the published CALERIE caloric-restriction effects. Use when the user mentions
  CALERIE, DunedinPACE in that trial, Waziry, or Belsky, Nature Aging 2023.
  Current medicines and checkup labs are context. The report does not say what
  to start or stop.
---

# 限食试验时钟

用户交时钟数值、现用药和体检。不要向用户要试验数据、GEO 或甲基化原始文件。

报告只把你给出的数值记下来，并在旁边放论文十二个月的一条组间效应量。没有数值时不抄效应量。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --clocks clocks.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out/
```

`clocks.csv` 用两列 `name,value`。方法说明见 [references/claims.md](references/claims.md)。
