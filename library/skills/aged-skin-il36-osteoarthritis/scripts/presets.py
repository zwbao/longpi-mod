BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。"
    "不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。"
    "体检不增删方法算出的名单。"
)
TITLE = "老化皮肤与关节炎症"
HIDDEN_COHORT = "41.06"


def _raw(values, keys):
    for key in keys:
        if key in values:
            return values[key]
        for have, raw in values.items():
            if have.lower() == key.lower():
                return raw
    return None


def _num(values, keys):
    raw = _raw(values, keys)
    if raw is None:
        return None
    try:
        return float(raw)
    except ValueError:
        return None

MARKERS = ("IL-36Ra", "IL-36α", "IL-36β", "IL-36γ")
ALIASES = (
    ("spesolimab", "spesolimab"),
    ("il-36ra", "IL-36Ra"),
    ("il36ra", "IL-36Ra"),
    ("il-36a", "IL-36α"),
    ("il-36α", "IL-36α"),
    ("il-36b", "IL-36β"),
    ("il-36β", "IL-36β"),
    ("il-36g", "IL-36γ"),
    ("il-36γ", "IL-36γ"),
)
# Methods. Microneedle release percents. Not a personal dose.
RELEASE_24H = "41.06"
RELEASE_168H = "73.37"

def assess(age, values, bad):
    computed, missing, items = [], [], []
    if bad:
        missing.append("有测量行读不了，那些行没有进入名单。")
    any_value = False
    for name in MARKERS:
        raw = _raw(values, (name,))
        if raw is None:
            items.append((name, "这次没有这项测量。"))
        else:
            any_value = True
            computed.append(f"{name} 的测量是 {raw}。没有系数，不算关节分数。")
            items.append((name, f"测量是 {raw}。没有系数，不算关节分数。"))
    items.append(("spesolimab", "论文点了这个名字。没有个人剂量系数。"))
    if not any_value:
        missing.append("四个 IL-36 相关测量都没有给。")
    missing.append("正文没有把血清浓度换成 OARSI 或疼痛分数的系数列。补充信息文件这次没有打开，不把没打开写成论文没公布。")
    return computed, missing, items
