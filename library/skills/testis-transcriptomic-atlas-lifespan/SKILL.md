---
name: testis-transcriptomic-atlas-lifespan
description: >-
  Places one adult's age and body-mass index against the two somatic aging waves in the human testis atlas of Cui et al., Nature Aging 2025. It does not run the notebook XGBoost grid. Use when the user mentions this testicular aging atlas, peritubular priming, or the age-BMI fertility note. Medicines and labs stay context.
---

# 睾丸衰老阶段

你交年龄，也可以交体质指数。年龄落在图谱范围内时，报告说明落在哪一个十年组。名单是三类细胞。没有合适的年龄，报告说明没有对照阶段。

不要向用户要单细胞矩阵或 PDF。不要用笔记本里的超参造一个年龄。现用药对不上时写「不能据此停」。体检不增删细胞类型。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 50 \
  --out out
```

`--measurements` 用 `item,value,unit` 三列，可含 `bmi`（也认 `BMI`、`体质指数`），单位是 kg/m²，单位列可以留空；只有 `item,value` 两列也行。`--age` 用岁，必须给。`skill.json` 列出名字、单位和合理范围（体质指数 10–100，年龄 18–110 岁）。没有年龄、单位不能换算、数值不在合理范围或读不出来时不对照：报告写明原因，脚本退出码 3。`out/result.json` 写出 `age_group`（十年组）和 `age_over_45_and_bmi_30`（是或否）。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
