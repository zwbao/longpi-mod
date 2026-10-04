---
name: neuron-aging-clocks
description: >-
  Places named C. elegans neuron types on the BitAge table from
  Meyer-DH/NeuronAging and marks the young and old quantile used by that
  code. Use when the user mentions neuron-type aging clocks, BitAge, syringic
  acid, vanoxerine, or Gallrein and Meyer, Nature Aging 2026. Current
  medicines and checkup labs are context. The report does not say what to
  start or stop.
---

# 神经元预测年龄

用户交线虫神经元名字、现用药和体检。不要向用户要 CeNGEN、GTEx 或 PDF。

报告只把点名的神经元对照预测小时数。丁香酸、钥更西汀和放线菌酮是论文测试过的化合物，不是这次的个人结果。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --neurons neurons.txt \
  --medications meds.txt \
  --labs checkup.csv \
  --out out/
```

`neurons.txt` 每行一个神经元名字，例如 ALN。方法说明见 [references/claims.md](references/claims.md)。
