---
name: paracrine-senescence-inflammation
description: >-
  Lists the senescence and SASP genes named by Tsuji et al., Nature Aging 2022,
  when those names are supplied. It does not compute a senescence score and does
  not turn experimental senolytic doses into personal advice. Use when the user
  mentions paracrine senescence, post-acute COVID inflammation, or this paper.
  Current medicines and checkup labs stay context. The report does not say what
  to start or stop.
---

# 感染后的旁分泌衰老

你交正文点名的衰老和炎症标志，以及可选的年龄、现用药和体检。对上的名字会写上论文里的方向。没有系数，也不把实验剂量写成你的剂量。

不要向用户要 GEO、STRING、PDF 或补充表。现用药对不上时写「不能据此停」。体检不增删方法算出的名单。

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

`--measurements` 用 `name,value`。可以用 CDKN2A、IL32、CXCL14、MMP10、IL1B、IL8。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
