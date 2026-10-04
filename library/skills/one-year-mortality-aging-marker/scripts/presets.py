"""No scoring coefficients. The baseline model is age and sex only.

doi:10.1038/s43587-024-00657-5. Methods: an unpenalized logistic regression
uses only age and sex. The coefficient columns are not in the PDF.
RNN hyperparameters in Methods are a learning rate, weight decay, dropout,
and layer sizes, not a saved weight matrix.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "一年死亡标记"

# Results: individuals alive and not emigrated on 1 January 2020. Stays out of the report.
COHORT_N = 5364032

MISSING = (
    "不能算一年死亡概率。基线逻辑回归缺年龄系数、性别系数和截距。"
    "已打开的 43587_2024_657_MOESM4_ESM.xlsx 和 MOESM5 是人数和性能曲线，没有这些系数列。"
    "仓库 model/RNN_EHR_model.py 没有保存的权重文件。"
)


def build(measurements: dict[str, str], age: float | None) -> tuple[str, list[str]]:
    sex = measurements.get("sex") or measurements.get("性别") or ""
    items = ["能算的：", ""]
    if age is None and not sex:
        items.append("没有给出年龄或性别。即便给了，也没有系数可乘。")
        lead = "这次没有一年死亡概率。"
    else:
        if age is not None:
            items.append(f"- 你给出的年龄是 {age:g} 岁。")
        if sex:
            items.append(f"- 你给出的性别是 {sex}。")
        items.append("这两项是基线模型的输入。这里没有把它们变成概率。")
        lead = "年龄和性别只被照录。一年死亡概率不算。"
    items.extend(["", "不能算的：", "", MISSING])
    return lead, items
