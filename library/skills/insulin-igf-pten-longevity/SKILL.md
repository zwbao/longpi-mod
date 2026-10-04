---
name: insulin-igf-pten-longevity
description: >-
  Checks whether a supplied amino-acid change matches DAF-18 C150Y (yh1,
  syb499) or human PTEN C105Y from Park et al., Nature Communications 2021,
  and keeps C124S as the named phosphatase-dead control. It does not convert
  the variant into a lifespan. Use when the user mentions daf-18(yh1), PTEN
  C105Y, or insulin/IGF-1 signaling in C. elegans. Medicines and checkup labs
  do not edit the method list. The report does not say what to start or stop.
---

# 胰岛素通路里的磷酸酶变体

用户交一个氨基酸替换或等位基因名字、可选的年龄、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。

报告只核对这个名字是不是正文点名的 C150Y、C105Y、C124S、yh2 或 yh3。对不上就照实写。没有替换时写明缺 variant。生存数据集里的数字不写成这个人的寿命。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 70 \
  --out out
```

`measurements.csv` 用 `name,value`。替换放在 `variant`。

把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
