---
name: sleep-study-life-expectancy
description: >-
  Subtracts chronological age from a supplied polysomnogram age estimate,
  which is the age-estimate error defined in the sleep-study paper. Use
  when the user mentions PSG age, age estimate error, or life expectancy
  from a sleep study. Network weights are not in the PDF, so no personal
  mortality probability is scored. Medicines and checkup labs do not edit
  the difference.
---

# 睡眠年龄差

用户交睡眠研究给出的年龄估计、实足年龄、现用药和体检。不要向用户要 GEO、STRING、PDF 或补充表。

两项都给出时，报告做减法。这不是死亡概率。网络权重不在 PDF 里，也不在已打开的补充文档的表里。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 70 \
  --out out
```

`--measurements` 用 `name,value,unit` 三列，只有 `name,value` 两列或没有表头也行。年龄估计的名字是 `age_estimate`，也认 `年龄估计`、`PSG age`；它是多导睡眠图模型给出的年龄（岁），不是年龄差。`--age` 是实足年龄。`skill.json` 列出全部名字、单位和合理范围（年龄估计 10–150 岁，实足年龄 18–110 岁）。缺一项、单位不能换算、数值不在合理范围或读不出来时不做减法：报告写明原因，脚本退出码 3。`out/result.json` 写出 `age_estimate_error`。`--medications` 一行一个名字。`--labs` 是 `项目,结果,单位`。把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。
