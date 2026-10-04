---
name: terpenoid-autophagy-sarcopenia
description: >-
  Lists thymol, carvacrol, their human conjugates, oregano oil, and the three previously reported pilot molecules named in Civiletto et al., Nature Aging 2025. Supplementary Table 2 ranks the natural-product screen, but those zebrafish log2 areas are not a personal score, and the epigenetic clock weights are absent. Use when the user mentions this terpenoid autophagy screen, thymol, or carvacrol. Experimental doses are not personal instructions.
---

# 草本萜类与自噬

名单是正文点名的自噬激活物。补充表里的斑马鱼荧光面积不换成个人分数。表观遗传年龄缺位点权重列，所以不算。实验浓度不写成用法。

不要向用户要 GEO、STRING、PDF 或补充表。现用药对不上时写「不能据此停」。体检不增删名单。

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

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
