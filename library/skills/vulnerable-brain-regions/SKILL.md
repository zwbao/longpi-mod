---
name: vulnerable-brain-regions
description: >-
  Lists the twelve modifiable factors from Table 3 of the vulnerable-brain-network
  paper and marks which ones the user reported. Use when the user mentions LIFO
  brain regions, modifiable dementia risk factors, diabetes, nitrogen dioxide,
  or alcohol intake in Manuello and Cox, Nature Communications 2024. Current
  medicines and checkup labs are context. The report does not say what to start
  or stop.
---

# 脆弱脑网络因素

用户交自己报告了的因素、现用药和体检。不要向用户要影像或 PDF。

报告只标出你报告了的因素。没有报告时不逐条列出相关。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --factors factors.txt \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

`factors.txt` 每行一个因素，例如糖尿病或饮酒。方法说明见 [references/claims.md](references/claims.md)。
