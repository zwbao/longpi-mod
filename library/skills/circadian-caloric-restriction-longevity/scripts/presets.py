BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。"
    "不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。"
    "体检不增删方法算出的名单。"
)
TITLE = "限食时刻与寿命"
HIDDEN_COHORT = 1068


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

# Results. Median lifespan in days. Cohort results, not a personal lifespan.
MEDIAN_DAYS = {
    "AL": 792,
    "CR-spread": 875,
    "CR-day-12h": 942,
    "CR-day-2h": 959,
    "CR-night-12h": 1058,
    "CR-night-2h": 1068,
}
CR_PERCENT = 30
ALIASES = ()
PHASES = {
    "al": "al", "adlib": "al", "随意": "al", "自由": "al",
    "day": "day", "白天": "day",
    "night": "night", "夜晚": "night", "夜间": "night",
    "spread": "spread", "分散": "spread", "全天": "spread",
}

def assess(age, values, bad):
    computed, missing, items = [], [], []
    if bad:
        missing.append("有测量行读不了，那些行没有进入名单。")
    raw_phase = _raw(values, ("phase", "相位"))
    phase = PHASES.get(raw_phase.strip().lower()) if raw_phase else None
    if raw_phase and phase is None:
        phase = PHASES.get(raw_phase.strip())
    cal = _num(values, ("calorie_percent", "热量限制"))
    feed = _num(values, ("feeding_hours", "进食小时"))
    fast = _num(values, ("fasting_hours", "禁食小时"))
    conflict = False
    if feed is None and fast == 22:
        feed = 2
    elif feed is None and fast == 12:
        feed = 12
    elif fast is not None and feed is not None:
        if (fast == 22 and feed != 2) or (fast == 12 and feed != 12):
            conflict = True
    arm = None
    if conflict:
        missing.append("进食小时和禁食小时对不上，不对组。")
    elif phase == "al" or cal == 0:
        arm = "AL"
    elif cal == CR_PERCENT and phase == "spread":
        arm = "CR-spread"
    elif cal == CR_PERCENT and phase in ("day", "night") and feed in (2, 12):
        arm = f"CR-{phase}-{int(feed)}h"
    if arm:
        computed.append(f"对上正文的 {arm}。这一组的中位寿命是队列结果，不写成这个人的寿命。")
        items.append((arm, "对上这一组。中位寿命不写在这里。"))
    else:
        items.append(("组别", "这次没有对上。"))
        bits = []
        if cal is None and phase != "al":
            bits.append("热量限制百分比")
        if phase is None:
            bits.append("进食相位")
        if phase in ("day", "night") and feed is None:
            bits.append("进食窗口小时")
        if cal not in (None, 0, CR_PERCENT):
            bits.append("百分比不是正文的三成热量限制")
        missing.append("没有对上六组。缺的是：" + ("、".join(bits) if bits else "能对上组名的组合") + "。")
    missing.append("正文没有把人的进食时刻换成寿命的系数列。")
    return computed, missing, items
