---
name: aging-biomarker-framework
description: >-
  Computes age deviation for clocks the user already has and annotates them
  with the Biolearn evaluation in Ying et al., Nature Aging 2025. Use when the
  user mentions Biolearn, GrimAge2 mortality, Horvath skin and blood R², or
  whether age prediction matches mortality prediction. Current medicines and
  checkup labs are context. The report does not say what to start or stop.
---

# 衰老标志物对照

用户交已经算好的预测年龄和实足年龄、现用药和体检。不要向用户要队列或系数文件。

报告只做预测年龄减实足年龄。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --clocks clocks.csv \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

`clocks.csv` 用三列 `name,predicted,age`；也可以用 `name,value,unit` 三列，再用 `--age` 给实足年龄。`skill.json` 列出能认的时钟名、单位和范围：预测年龄在 10–150 岁，实足年龄在 18–110 岁。DunedinPACE 和 DunedinPoAm38 是衰老速度（约 1），只列出，不算年龄偏差。甲基化 PhenoAge 和九项血检算出的表型年龄是两项，名字不要混用。数值不在范围、单位不对或读不出来时不计算，报告写明原因，脚本退出码 3。`out/result.json` 写各时钟的年龄偏差。方法说明见 [references/claims.md](references/claims.md)。
