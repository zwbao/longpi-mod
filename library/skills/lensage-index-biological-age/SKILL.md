---
name: lensage-index-biological-age
description: >-
  Computes the LensAge index as lens age minus chronological age, as defined by Li et al., Nature Communications 2023, and compares that index with the printed fast-ager cutoffs of 5, 10, and 20 years. It does not run the unavailable InceptionV3 model. Use when the user mentions LensAge or a lens photograph age minus chronological age. Medicines and checkup labs stay context.
---

# 晶状体年龄指数

你交已经得到的晶状体年龄和实足年龄。报告用前者减去后者，并对照大于 5 年、10 年和 20 年这三个快老化切点。两个数缺一个时，报告说明没有算出指数。

不要向用户要照片模型或 PDF。不要另造网络权重。现用药对不上时写「不能据此停」。体检不增删指数。

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

`lens_age` 和 `chronological_age` 用岁。文件里的实足年龄优先于命令行年龄。

方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
