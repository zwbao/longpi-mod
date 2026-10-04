---
name: navy-circumference-body-fat
description: >-
  Estimates body-fat percentage from height, neck, waist and (for women) hip circumference with the U.S. Navy
  equations of Hodgdon and Beckett (1984, body density in cm plus Siri), and grades abdominal fat with the
  waist-to-height ratio 0.5 boundary (Ashwell and Hsieh 2005; Browning et al. 2010), the WHO 2008 waist-to-hip ratio
  cut-offs and the Chinese central-obesity waist cut-offs of WS/T 428-2013. Use for 体脂率, 腰围, 腰臀比, 腰围身高比,
  中心型肥胖, 腹型肥胖, 啤酒肚. States that the Navy equations come from U.S. military personnel. Does not track weight.
---

# 体脂率（海军围度方程）和腰围分档

用户交自己量的身高、颈围、腰围、臀围和性别，年龄可选。不要向用户要体重、体脂秤读数或 PDF，公式和切点已经在技能里。

## 命令

```bash
python "$SKILL/scripts/personal_report.py" --measurements body.csv --sex female --age 42 --out out
```

`body.csv` 的列是 `item,value,unit`：

- 腰围（必填）、臀围、颈围：cm，也接受 in、mm、m。
- 身高：cm，也接受 m、in、mm。
- 名称也认 waist、hip、neck、height、腹围 等，`skill.json` 列出全部。

能算什么取决于给了什么：

| 结果 | 需要 |
| --- | --- |
| 体脂率（海军方程） | 男：身高、颈围、腰围；女：再加臀围 |
| 腰围身高比，0.5 界值 | 腰围、身高 |
| 腰臀比，WHO 切点（男 ≥0.90，女 ≥0.85） | 腰围、臀围 |
| 中心型肥胖（WS/T 428-2013：男 ≥90 cm，女 ≥85 cm；前期 男 85–<90，女 80–<85） | 腰围 |

缺性别、年龄小于 18 岁、单位不认识、数值超出合理范围时不计算：报告写明原因，脚本退出码 3。`out/result.json` 给出 `body_fat_pct`、`waist_height_ratio`、`waist_height_category`、`waist_hip_ratio`、`waist_hip_category` 和 `central_obesity_cn`。

## 报告里必须保留的话

- 海军方程由美国海军现役人员建立（男 602 人 18–56 岁，女 214 人 18–44 岁），用在中国成人身上误差可能更大；估计误差男 3.52、女 3.72 个百分点。
- 三种方法量腰围的位置不同（海军男性在肚脐，女性在腰最细处，WHO 和国家标准在肋弓下缘和髂嵴连线中点）。
- 体脂率没有健康分档，只报数字。超过切点时写「提示腹部脂肪偏多」，建议下次体检一起查血压、血糖、血脂，由医生评估；不写诊断。

体重、BMI、体脂秤和趋势不在这里算，LongPi 自己记体重。引用 `out/report.md`，包括 `边界:` 那一行。来源和核对见 [references/contract.md](references/contract.md)。
