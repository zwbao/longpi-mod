BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。"
    "不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。"
    "体检不增删方法算出的名单。"
)
TITLE = "可穿戴加速度的昼夜年龄"
HIDDEN_COHORT = 76026


from decimal import Decimal, ROUND_HALF_UP, localcontext

# Supplementary Table 1, All column, and the closed form printed under it.
MESOR_COEF = Decimal("-0.032")
AMPLITUDE_COEF = Decimal("-0.020")
ACROPHASE_COEF = Decimal("-0.017")
AGE_COEF = Decimal("0.100")
RATE = Decimal("-13.367")
GAMMA = Decimal("0.015")
MONTHS = Decimal("60")
INTERCEPT = Decimal("133.599")
DIVISOR = Decimal("0.112")
# Same table, female and male columns. The closed-form intercept and divisor are not printed for these columns.
FEMALE = {"mesor": "-0.026", "amplitude": "-0.022", "acrophase": "-0.132", "age": "0.088", "shape": "0.013", "rate": "-13.285"}
MALE = {"mesor": "-0.024", "amplitude": "-0.031", "acrophase": "0.009", "age": "0.102", "shape": "0.014", "rate": "-13.017"}
PI = Decimal("3.141592653589793")
ALIASES = ()

# Names assess() reads for each measurement row; each tuple includes the skill.json key.
MESOR_NAMES = ("MESOR", "mesor")
AMPLITUDE_NAMES = ("amplitude", "振幅")
ACROPHASE_NAMES = ("acrophase", "acrophase_rad", "相位")
ACROPHASE_HOUR_NAMES = ("acrophase_hour", "峰时")
# (skill.json key, names assess() reads, unit). MESOR and amplitude are ENMO in mg
# (thousandths of g); schema/units.json has no acceleration unit, so they carry none.
# Acrophase in radians is a pure number, clock hour × 2π/24.
MEASUREMENTS = (
    ("mesor", MESOR_NAMES, ""),
    ("amplitude", AMPLITUDE_NAMES, ""),
    ("acrophase_rad", ACROPHASE_NAMES, "1"),
    ("acrophase_hour", ACROPHASE_HOUR_NAMES, "h"),
)

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


def _dec(values, keys):
    raw = _raw(values, keys)
    if raw is None:
        return None
    try:
        return Decimal(raw)
    except Exception:
        return None

def cosinor_age(mesor, amplitude, acrophase, age):
    with localcontext() as ctx:
        ctx.prec = 50
        bx = RATE + MESOR_COEF * mesor + AMPLITUDE_COEF * amplitude + ACROPHASE_COEF * acrophase + AGE_COEF * age
        expo = ((MONTHS * GAMMA).exp() - 1) * bx.exp() / GAMMA
        mortality = 1 - (-expo).exp()
        if mortality <= 0 or mortality >= 1:
            return None
        inner = -GAMMA * (1 - mortality).ln()
        if inner <= 0:
            return None
        return INTERCEPT + inner.ln() / DIVISOR

def _years(value):
    return str(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def acrophase_radians(values):
    """Acrophase in radians from the radian row or the clock-hour row.

    Returns (radians or None, clash). clash is True when both rows are given and
    differ by more than 0.01 rad; then neither is used.
    """
    acro = _dec(values, ACROPHASE_NAMES)
    hour = _dec(values, ACROPHASE_HOUR_NAMES)
    if hour is None:
        return acro, False
    hour_rad = hour * 2 * PI / Decimal(24)
    if acro is None:
        return hour_rad, False
    if abs(acro - hour_rad) > Decimal("0.01"):
        return None, True
    return acro, False


def estimate(age, values):
    """(CosinorAge, CosinorAgeAdvance) in years, or (None, None) when not computed."""
    mesor = _dec(values, MESOR_NAMES)
    amplitude = _dec(values, AMPLITUDE_NAMES)
    acro, _clash = acrophase_radians(values)
    if mesor is None or amplitude is None or acro is None or age is None:
        return None, None
    hat = cosinor_age(mesor, amplitude, acro, Decimal(str(age)))
    if hat is None:
        return None, None
    return hat, hat - Decimal(str(age))


def assess(age, values, bad):
    computed, missing, items = [], [], []
    if bad:
        missing.append("有测量行读不了，那些行没有进入名单。")
    mesor = _dec(values, MESOR_NAMES)
    amplitude = _dec(values, AMPLITUDE_NAMES)
    acro, clash = acrophase_radians(values)
    if clash:
        missing.append("弧度相位和钟点小时换算后不一致，不算。")
    absent = []
    if mesor is None:
        absent.append("MESOR")
    if amplitude is None:
        absent.append("振幅")
    if acro is None and "不一致" not in "".join(missing):
        absent.append("相位")
    if age is None:
        absent.append("实足年龄")
    if absent or acro is None or mesor is None or amplitude is None or age is None:
        items.append(("CosinorAge", "这次没有算。"))
        items.append(("CosinorAgeAdvance", "这次没有算。"))
        if absent:
            missing.append("缺" + "、".join(absent) + "。缺的项不用 0 填。")
    else:
        hat, advance = estimate(age, values)
        if hat is None:
            items.append(("CosinorAge", "这次没有算。"))
            items.append(("CosinorAgeAdvance", "这次没有算。"))
            missing.append("这组输入没有给出 0 到 1 之间的五年死亡率，不算年龄。")
        else:
            pace = "比实足年龄大，正文把这记成较快。" if advance > 0 else "不大于实足年龄，正文把这记成相同或较慢。"
            computed.append(f"CosinorAge 是 {_years(hat)} 岁。CosinorAgeAdvance 是 {_years(advance)} 岁。{pace}")
            items.append(("CosinorAge", f"{_years(hat)} 岁。"))
            items.append(("CosinorAgeAdvance", f"{_years(advance)} 岁。{pace}"))
    if _raw(values, ("sex", "性别")) is not None:
        missing.append("补充表 1 有女性和男性的 Gompertz 系数，但没有与全体模型 133.599 和 0.112 对应的反演常数，所以不算分性别年龄。")
    else:
        missing.append("分性别模型缺反演常数，这次只在四项齐全时使用全体公式。")
    return computed, missing, items
