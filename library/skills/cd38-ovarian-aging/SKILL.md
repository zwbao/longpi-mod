---
name: cd38-ovarian-aging
description: >-
  Places a supplied age in the young or middle-aged windows printed for human follicular-fluid donors, and attaches the organ direction for CD38 and NAD. Use when the user mentions ovarian CD38, 78c, or doi:10.1038/s43587-023-00532-9. RNA-seq counts have no intercept, so no personal NAD score is calculated. Labs do not add organs.
---

# 卵巢烟酰胺酶

用户交年龄、点到的器官、现用药和体检。不要向用户要 SRA、GEO、STRING 或 PDF。报告开头是论文卡片。

年龄只对照正文的两个窗。RNA-seq 表没有截距，所以不算个人 CD38 或 NAD 分数。现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --measurements measurements.csv \
  --medications meds.txt \
  --labs checkup.csv \
  --age 40 \
  --out out/
```

`measurements.csv` 用两列 `name,value`。器官写 `ovary,named` 或 `肝,named`。方法说明见 [references/claims.md](references/claims.md)。
