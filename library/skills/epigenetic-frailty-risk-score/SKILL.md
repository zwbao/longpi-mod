---
name: epigenetic-frailty-risk-score
description: >-
  Computes the epigenetic frailty risk score from the 20 CpG coefficients printed in Li et al. Figure 4. Use when the user mentions eFRS, an epigenetic frailty score, or this ESTHER and KORA methylation study. Beta values stay on the 0 to 1 scale. Current medicines and checkup labs do not change the CpG list or the score.
---

# 衰弱风险分

用户交甲基化数值、可选的衰弱指数、现用药和体检。不要向用户要 ESTHER、KORA、GEO、STRING 或 PDF。

没有完整的甲基化，就没有风险分。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --age 60 \
  --measurements betas.tsv \
  --out out
```

`betas.tsv` 每行是 `cg位点 β`。可选 `fi=0.2`，或 `esther_deficits=`、`kora_deficits=`。缺陷个数会除以正文里的 31 或 33。引用 `out/report.md`，包括 `边界:` 那一行。

也可以交带表头的 `marker,value,unit` 表，每行一个 cg 位点，或 `fi`、`esther_deficits`、`kora_deficits`。`skill.json` 列出能认的名字、单位和范围。β 值和衰弱指数要在 0 到 1 之间，百分比和 M 值不换算；缺陷个数不超过 31 或 33。数值超出范围、单位不对或读不出来时不计算，报告写明原因，脚本退出码 3。`out/result.json` 写 `efrs`、`frailty_index` 和 `frailty_band`。
