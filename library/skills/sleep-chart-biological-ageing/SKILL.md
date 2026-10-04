---
name: sleep-chart-biological-ageing
description: >-
  Writes a personal readout of the sleep-duration bins used with 23
  biological age gaps in the Nature 2026 sleep chart. Use when the user
  gives sleep hours, medicines, or checkup labs and asks where those hours
  sit in this chart. The skill does not ask for the PDF or a cohort. It
  does not turn a short or long bin into advice to start or stop a medicine.
---

# 睡眠时长分组

用户交自己的睡眠小时数、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

报告只把小时数放进短、正常或长。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

`--measurements` 用 `item,value,unit` 三列；单位列空着时按小时读，只有 `item,value` 两列也行。睡眠小时数的名字是 `sleep_hours`，也认 `sleep`、`睡眠时长`、`睡眠小时数`、`总睡眠时长` 等，`skill.json` 列出全部名字、单位和范围。按分钟记的在单位列写 `min` 或 `分钟`，会换成小时。换成小时后不在 2–16 之间、单位不能换算或结果不是数时不分组：报告写明原因，脚本退出码 3。`out/result.json` 写出 `sleep_duration_bin`（短、正常或长；没有小时数时为空）。
