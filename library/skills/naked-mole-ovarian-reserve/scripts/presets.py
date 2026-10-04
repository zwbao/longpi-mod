"""Correction factors named in the germ-cell counting paragraph."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Methods, Germ cell counting. P15 is not given.
FACTORS = {
    "p1": 1.5,
    "p5": 1.5,
    "p8": 1.5,
    "p28": 2.0,
    "p90": 2.5,
    "p6mo": 2.5,
    "adult": 2.5,
    "3yr": 2.5,
}

# Main text, per ovary pair at P8. Kept out of the personal report.
P8_GERM_CELLS = 1500000

STAGE_ALIASES = {
    "p1": "p1",
    "p5": "p5",
    "p8": "p8",
    "p15": "p15",
    "p28": "p28",
    "p90": "p90",
    "p6mo": "p6mo",
    "6mo": "p6mo",
    "6month": "p6mo",
    "6months": "p6mo",
    "adult": "adult",
    "成年": "adult",
    "3yr": "3yr",
    "3year": "3yr",
    "3years": "3yr",
    "3yrsub": "3yr",
    "3yrexsub": "3yr",
}


def canonical_stage(text):
    if text is None:
        return None
    token = text.strip().casefold().replace(" ", "").replace("_", "").replace("-", "")
    return STAGE_ALIASES.get(token)
