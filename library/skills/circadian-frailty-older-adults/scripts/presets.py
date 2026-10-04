BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。"
    "不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。"
    "体检不增删方法算出的名单。"
)
TITLE = "昼夜活动与衰弱"
HIDDEN_COHORT = 1022


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

ALIASES = ()
YES = {"1", "yes", "y", "是", "有"}
NO = {"0", "no", "n", "否", "无"}

# Names assess() reads for each measurement row; each tuple includes the skill.json key.
M10_NAMES = ("M10", "m10")
L5_NAMES = ("L5", "l5")
EFFORT_NAMES = ("fatigue_effort", "费力")
GOING_NAMES = ("fatigue_going", "提不起劲")
# (skill.json key, names assess() reads, unit). M10 and L5 are activity in whatever
# unit the device gives (counts in the paper); relative amplitude only needs the two
# in the same unit, so they carry none. Each fatigue answer scores 0 or 1.
MEASUREMENTS = (
    ("m10", M10_NAMES, ""),
    ("l5", L5_NAMES, ""),
    ("fatigue_effort", EFFORT_NAMES, "score"),
    ("fatigue_going", GOING_NAMES, "score"),
)

def _bit(raw):
    if raw is None:
        return None
    token = raw.strip().lower()
    if token in YES:
        return 1
    if token in NO:
        return 0
    return None


def relative_amplitude(values):
    """(M10−L5)/(M10+L5), or None when M10 or L5 is missing or both are 0."""
    m10 = _num(values, M10_NAMES)
    l5 = _num(values, L5_NAMES)
    if m10 is None or l5 is None or m10 + l5 == 0:
        return None
    return (m10 - l5) / (m10 + l5)


def fatigue_score(values):
    """The two fatigue answers added up (yes is 1), or None when one is missing."""
    effort = _bit(_raw(values, EFFORT_NAMES))
    going = _bit(_raw(values, GOING_NAMES))
    if effort is None or going is None:
        return None
    return effort + going


def assess(age, values, bad):
    computed, missing, items = [], [], []
    if bad:
        missing.append("有测量行读不了，那些行没有进入名单。")
    m10 = _num(values, M10_NAMES)
    l5 = _num(values, L5_NAMES)
    if m10 is None or l5 is None:
        items.append(("相对振幅", "这次没有算。"))
        missing.append("缺 M10 或 L5，不算相对振幅。缺的项不用 0 填。")
    elif m10 + l5 == 0:
        items.append(("相对振幅", "这次没有算。"))
        missing.append("M10 与 L5 之和为 0，公式除不开。")
    else:
        ra = relative_amplitude(values)
        computed.append(f"相对振幅是 {ra:.4f}。公式是 (M10−L5)/(M10+L5)。")
        items.append(("相对振幅", f"{ra:.4f}。"))
    score = fatigue_score(values)
    if score is None:
        items.append(("疲劳分", "这次没有算。"))
        missing.append("疲劳分缺一道题。两道题是「做事费力」和「提不起劲」，答「是」记 1。")
    else:
        computed.append(f"疲劳分是 {score}。范围是 0 到 2。")
        items.append(("疲劳分", f"{score}。"))
    items.append(("衰弱表型", "这次没有算。"))
    missing.append("衰弱表型需要五项里至少三项。握力、八英尺步时、体质指数和每周活动小时缺性别特异的最低五分位切点。已打开的 MOESM4 没有这些列。MOESM1 已打开，14 页，是报告清单，没有切点。MOESM3 已打开，22 页，是审稿意见，也没有五分位切点。")
    return computed, missing, items
