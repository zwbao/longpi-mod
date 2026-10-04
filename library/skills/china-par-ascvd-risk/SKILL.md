---
name: china-par-ascvd-risk
description: >-
  China-PAR 10-year atherosclerotic cardiovascular disease risk for Chinese adults (Yang et al., Circulation 2016),
  from systolic blood pressure, total and HDL cholesterol, waist, age, sex and yes/no factors, for men and women.
  Use for 心血管风险, 10年风险, China-PAR, or what-if goals for blood pressure and lipids.
---

# China-PAR 10 年心血管病风险

## 这个方法算什么

China-PAR 是中国四个队列建立的 10 年动脉粥样硬化性心血管病（心梗、冠心病死亡、脑卒中）风险方程，男女分开。2019 年《中国心血管病风险评估和管理指南》用它做分层：低于 5% 低危，5%–9.9% 中危，10% 及以上高危。

## 输入

- 测量值（`--measurements`，列 item,value,unit）：收缩压（mmHg）、总胆固醇、高密度脂蛋白胆固醇（mg/dL 或 mmol/L，必须写单位）、腰围（cm）。
- 档案：实足年龄（`--age`）、性别（`--sex`）。
- 是否项：`--treated`（两周内用过降压药）、`--smoker`、`--diabetes`（空腹血糖 ≥7.0 mmol/L 或在用降糖药）、`--north`（长江以北），男性还要 `--urban`、`--family-history`（父母或兄弟姐妹有心梗或脑卒中）。都用 yes 或 no。
- 可选 `--targets`：目标值表（同样的列），脚本另写 `out/levers.json`，给出达到目标时的风险和每一项单独达标的变化。

```bash
python3 scripts/personal_report.py --measurements m.csv --age 55 --sex male \
  --treated no --smoker no --diabetes no --north yes --urban yes --family-history no --out out
```

## 限制

- 论文印出的两位小数系数和女性基线生存率（0.99）复现不了论文自己的结果。这里男性六个连续项的系数由补充表 1 的“系数×值”列反推，女性基线生存率 0.9851 由女性计算示例反推；复现论文表 2 的误差在 1% 以内，2019 年指南的例子算出 4.9%（官方 4.7%，同为低危）。推导和核对见 `references/contract.md`。
- 论文用诊室坐位三次测量的平均收缩压；家用血压计读数通常偏低。
- 方程由 35–74 岁人群推导，年龄在范围外时结果更不确定。

## 边界

这是和你条件相同的中国成人的平均风险，是模型估计，不是诊断，也不决定是否用药。
