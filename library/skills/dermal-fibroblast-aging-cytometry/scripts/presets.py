BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。"
    "不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。"
    "体检不增删方法算出的名单。"
)
TITLE = "真皮成纤维细胞的纳米传感器表型"
HIDDEN_COHORT = 100000


# Results. Passage 5 is the young control. Passage 15 is the aged reference.
PASSAGE_YOUNG = 5
PASSAGE_AGED = 15
# Results. Predictions must exceed this confidence. Supplementary Figs. 8 and 9.
CONFIDENCE_MIN = 0.50
# Results. F1 stayed above this at confidence 0.4 and 0.5. Not used as a personal score.
F1_FLOOR = 0.97
PHENOTYPES = (
    ("cell_size", "细胞大小"),
    ("eccentricity", "偏心率"),
    ("refractive_index", "折射率"),
    ("h2o2_efflux", "过氧化氢外流"),
)
ALIASES = ()

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


def assess(age, values, bad):
    computed, missing, items = [], [], []
    if bad:
        missing.append("有测量行读不了，那些行没有进入名单。")
    passage = _num(values, ("passage", "代次"))
    if passage is None:
        missing.append("缺代次（passage）。")
        items.append(("代次参照", "这次没有算。"))
    elif passage == PASSAGE_YOUNG:
        computed.append("代次是第 5 代，对上正文的年轻对照。")
        items.append(("代次参照", "第 5 代，年轻对照。"))
    elif passage == PASSAGE_AGED:
        computed.append("代次是第 15 代，对上正文的衰老参照。")
        items.append(("代次参照", "第 15 代，衰老参照。"))
    else:
        computed.append("这个代次不是正文用作两端参照的第 5 代或第 15 代。")
        items.append(("代次参照", "不是第 5 代或第 15 代。"))
    confidence = _num(values, ("confidence", "置信度"))
    if confidence is None:
        missing.append("缺检测置信度（confidence）。阈值是超过 0.50。")
        items.append(("置信度", "这次没有算。"))
    elif confidence > CONFIDENCE_MIN:
        computed.append(f"置信度 {confidence:g} 超过 0.50，按正文算作有效检测。")
        items.append(("置信度", f"{confidence:g}，超过 0.50。"))
    else:
        computed.append(f"置信度 {confidence:g} 没有超过 0.50，正文不把这次预测算进去。")
        items.append(("置信度", f"{confidence:g}，没有超过 0.50。"))
    for key, label in PHENOTYPES:
        raw = _raw(values, (key, label))
        if raw is None:
            items.append((label, "这次没有这项测量。"))
        else:
            computed.append(f"{label} 是 {raw}。没有系数，不换成代次。")
            items.append((label, f"{raw}。没有系数，不换成代次。"))
    missing.append("代次预测的权重在 GitHub 仓库 NCC_Code，正文没有给出可点积的系数列。缺权重，不用 0 填。")
    return computed, missing, items
