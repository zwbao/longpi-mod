---
name: leukocyte-telomere-length
description: >-
  Places one person's z-standardised log leukocyte telomere length into the
  four quartiles printed by Codd et al., Nature Aging 2022. Use when the user
  mentions UK Biobank leukocyte telomere length, LTL, or a z-standardised
  telomere value. A raw T/S ratio is recorded but not binned, because the
  cohort mean and SD of the log ratio are not printed. Current medicines and
  checkup labs are context. The report does not say what to start or stop.
---

# 白细胞端粒

用户交已经 z 标准化的对数端粒，以及可选的现用药和体检。不要向用户要英国生物银行或 PDF。

表 2 的切点是：小于 -0.65 为最短，-0.65 到小于 -0.002 为次短，-0.002 到小于 0.65 为次长，大于等于 0.65 为最长。表 3 里年龄每增加一年，这个 z 下降 0.024。未标准化的 T/S 比值只记下，不分档。

现用药对不上时保留「不能据此停」。体检不增删方法算出的名单。

## 命令

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --z -0.7 \
  --medications meds.txt \
  --labs checkup.csv \
  --out out/
```

只有未标准化的比值时，用 `--ltl` 代替 `--z`。方法说明见 [references/claims.md](references/claims.md)。

`--z` 要在 -4 到 4 之间，`--ltl` 的 T/S 比值要在 0.1 到 4 之间；超出时不分档，报告写明原因，脚本退出码 3。以 kb 或 bp 计的端粒长度会被拦下；未标准化的 T/S 比值落在 z 的范围里，拦不下，不要把它当 `--z` 传。`out/result.json` 写出 `ltl_quartile`（最短、次短、次长或最长；没有 z 时为空）。
