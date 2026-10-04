---
name: gompertz-celegans-decrepitude
description: >-
  Computes relative healthspan and gerospan from two supplied durations,
  using the identity in the C. elegans Gompertz paper. Use when the user
  mentions decrepitude, gerospan, or slowed Gompertzian ageing in worms.
  Fitted alpha and beta are not in the opened source-data sheet, so no
  personal mortality probability is scored. Medicines and checkup labs
  do not edit the spans.
---

# 衰弱期比例

用户交健康期天数、衰弱期天数、现用药和体检。有日龄时加 `--age`。不要向用户要 GEO、STRING、PDF 或补充表。

两段天数都给出时，报告按正文的恒等式计算相对比例。拟合的尺度参数和速率参数不在已打开的补充表列里，不算死亡概率。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 20 \
  --out out
```

`--measurements` 用 `name,value`。健康期天数的名字是 `h_span_days`，衰弱期天数的名字是 `g_span_days`。`--medications` 一行一个名字。`--labs` 是 `项目,结果,单位`。把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
