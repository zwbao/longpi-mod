"""Age-estimate error is a subtraction. Network weights are not stored here.

doi:10.1038/s41746-022-00630-9. The paper defines AEE as the age difference
between the model age estimate and chronological age. Supplementary Table 1
holds hyperparameters, not a weight matrix.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "睡眠年龄差"

# Abstract: tested in this many PSGs. Stays out of the report.
COHORT_N = 10699

MISSING = (
    "不能算死亡概率。补充材料 41746_2022_630_MOESM1_ESM.docx 的表是超参数、误差和关联系数，"
    "没有网络权重列。仓库里有检查点，例如 data/model_eeg5/modelL/latest_checkpoint.tar，"
    "那份文件不在 PDF 里，这次不用它。"
)


def _num(text: str | None) -> float | None:
    if text is None or text == "":
        return None
    return float(text)


def build(measurements: dict[str, str], age: float | None) -> tuple[str, list[str]]:
    estimate = _num(measurements.get("age_estimate", measurements.get("年龄估计")))
    items = ["能算的：", ""]
    if estimate is None or age is None:
        items.append("没有同时给出年龄估计和实足年龄，年龄差不算。")
        lead = "这次没有同时给出年龄估计和实足年龄。"
    else:
        error = estimate - age
        items.append(f"- 年龄估计 {estimate:g} 岁，实足年龄 {age:g} 岁，年龄差 {error:g} 岁。")
        items.append("这个差是估计年龄减去实足年龄。它不是死亡概率。")
        lead = "这次用正文对年龄差的定义做了减法。"
    items.extend(["", "不能算的：", "", MISSING])
    return lead, items
