---
name: ampk-aldolase-aldometanib
description: >-
  Computes the difference between two supplied fasting glucose values, the
  glucose endpoint of the aldometanib experiments in Zhang et al., Nature
  Metabolism 2022. It does not convert mouse doses or the published lifespan
  summaries into a personal dose or a personal lifespan. Use when the user
  mentions aldometanib, LXY-05-029, lysosomal AMPK, or aldolase inhibition.
  Checkup labs and current medicines do not edit the method list. The report
  does not say what to start or stop.
---

# 醛缩酶抑制剂与空腹血糖

用户交两次空腹血糖、可选的血清化合物浓度、年龄、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。

两次血糖都有时，报告写出后一次减去前一次。缺一列就写明缺哪一列，不用别的数去填。寿命表和动物剂量留在方法说明里。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 70 \
  --out out
```

`measurements.csv` 用 `name,value`。血糖列名是 `fasting_glucose_before_mM` 和 `fasting_glucose_after_mM`。血清列名是 `serum_aldometanib_nM`，可以空着。

把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
