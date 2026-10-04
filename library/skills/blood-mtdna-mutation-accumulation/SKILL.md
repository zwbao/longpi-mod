---
name: blood-mtdna-mutation-accumulation
description: >-
  Classifies one mtDNA substitution against the age-60 inflection and the
  age-accumulating classes in Gupta et al., Nature 2026, and checks the
  clonal-hematopoiesis genes named in the text. Use when the user mentions
  age-related mtDNA mutations in blood, TERT, TCL1A, or cryptic clonal
  hematopoiesis. Disease odds ratios are not computed. Medicines and checkup
  labs stay context. The report does not say what to start or stop.
---

# 血液线粒体突变累积

用户交替换类型、链、是否在复制原点、可选的异质性和基因名，以及年龄、现用药和体检。不要向用户要英国生物银行、All of Us 或 PDF。

60 岁之后是正文写的累积切点。重链 C>T 和两条链上的 A>G 属于随年龄累积的大类。轻链 A>G 的三核苷酸上下文没有印成可检索的表，不再筛。原点区不标成这一类。异质性低于 0.05 时按未改版本的 mtSwirl 质控标成剔除。只对照正文点名的 TERT、TCL1A、SMC4 和七个稀有变异基因。

现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 80 \
  --out out/
```

`measurements.csv` 用两列 `name,value`。`--medications` 每行一个名字。`--labs` 是 `项目,结果,单位`。

方法说明见 [references/claims.md](references/claims.md)。
