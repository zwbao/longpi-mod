---
name: ckd-epi-2021-egfr
description: >-
  Computes estimated glomerular filtration rate (eGFR) from serum creatinine, age and sex with the CKD-EPI 2021
  race-free equation (Inker et al., NEJM 2021), and with the 2021 creatinine-cystatin C equation when cystatin C is
  given; stages it with KDIGO 2024 GFR categories G1-G5 and, when a urine albumin-to-creatinine ratio is given,
  albuminuria categories A1-A3. Says plainly when to see a doctor and how KDIGO frames retesting. Use for 肾功能,
  肾小球滤过率, eGFR, 肌酐, 胱抑素C, 尿白蛋白/肌酐比, 慢性肾脏病分期. Does not track trends.
---

# 肾小球滤过率估计值（eGFR）和 KDIGO 分档

用户交一次化验里的血肌酐，可选胱抑素 C 和尿白蛋白/肌酐比，加上年龄和性别。不要向用户要论文、补充表或 PDF，系数已经在技能里。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" --measurements labs.csv --age 58 --sex female --out out
```

`labs.csv` 的列是 `item,value,unit`：

- 血肌酐（必填）：µmol/L 或 mg/dL。也认 肌酐、Scr、Cr、CREA。
- 胱抑素C（可选）：mg/L。有它时按 KDIGO 推荐 1.1.2.1 用肌酐加胱抑素 C 方程分档，两个数都报。
- 尿白蛋白/肌酐比（可选）：mg/g 或 mg/mmol，必须写单位。按化验单上的单位查 KDIGO 表 3 对应那一列。尿微量白蛋白浓度（mg/L）不是这个比值。

`--age` 必须 18 岁及以上；`--sex` 用 male/female 或 男/女。单位不认识、数值超出合理范围、缺肌酐、缺年龄或性别时不计算：报告写明原因，脚本退出码 3。`out/result.json` 给出 `egfr_cr`、`egfr_cr_cys`、`gfr_category`、`gfr_category_equation`、`albuminuria_category`、`kdigo_checks_per_year` 和 `doctor_visit`。

## 报告会说什么

- eGFR 四舍五入到整数（KDIGO 表 11），再按表 2 分 G1–G5。
- eGFR 低于 60，或白蛋白尿 A2 及以上：写「建议到肾内科或内科就诊」，并按 KDIGO 写复查：一次结果不能确定，要复查确认；异常持续至少 3 个月才算慢性；随机尿比值偏高要用晨尿复查。eGFR 低于 30 或 A3：写「尽快到肾内科就诊」。
- 都在正常范围时直接说是好消息。
- 不算趋势。LongPi 自己比较前后两次化验。

## 不做的事

- 不算只用胱抑素 C 的方程（没有可核对的示例值，见 `references/contract.md`）。
- 不下诊断，不给药量，不说加药、减药、停药；用药的事交给开药医生或药师。

引用 `out/report.md`，包括 `边界:` 那一行。数值来源和核对见 [references/contract.md](references/contract.md)。
