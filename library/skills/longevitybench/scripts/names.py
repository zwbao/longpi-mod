"""Match a person's own medicine names to DrugAge compound names and to the eight vector-field interventions."""

from __future__ import annotations

import re

from drugage import CompoundScore

# Longer aliases are tried first so 烟酰胺单核苷酸 does not collapse into 烟酰胺.
ALIASES: list[tuple[str, str]] = [
    ("烟酰胺单核苷酸", "Nicotinamide mononucleotide"),
    ("烟酰胺核糖", "Nicotinamide riboside"),
    ("乙酰水杨酸", "Aspirin"),
    ("拜阿司匹灵", "Aspirin"),
    ("阿司匹林", "Aspirin"),
    ("二甲双胍", "Metformin"),
    ("格华止", "Metformin"),
    ("雷帕霉素", "Rapamycin"),
    ("西罗莫司", "Rapamycin"),
    ("白藜芦醇", "Resveratrol"),
    ("亚精胺", "Spermidine"),
    ("槲皮素", "Quercetin"),
    ("非瑟酮", "Fisetin"),
    ("烟酰胺", "Nicotinamide"),
    ("阿卡波糖", "Acarbose"),
    ("姜黄素", "Curcumin"),
    ("维生素d3", "Vitamin D3"),
    ("维生素d", "Vitamin D3"),
    ("nmn", "Nicotinamide mononucleotide"),
    ("nicotinamide mononucleotide", "Nicotinamide mononucleotide"),
    ("nicotinamide riboside", "Nicotinamide riboside"),
]

INTERVENTION_ALIASES: list[tuple[str, str]] = [
    ("达沙替尼", "senolytics_dq"),
    ("dasatinib", "senolytics_dq"),
    ("槲皮素", "senolytics_dq"),
    ("quercetin", "senolytics_dq"),
    ("烟酰胺单核苷酸", "nad_precursors"),
    ("烟酰胺核糖", "nad_precursors"),
    ("nmn", "nad_precursors"),
    ("nr", "nad_precursors"),
    ("雷帕霉素", "rapamycin"),
    ("西罗莫司", "rapamycin"),
    ("rapamycin", "rapamycin"),
    ("二甲双胍", "metformin"),
    ("格华止", "metformin"),
    ("metformin", "metformin"),
    ("亚精胺", "spermidine"),
    ("spermidine", "spermidine"),
    ("非瑟酮", "fisetin"),
    ("fisetin", "fisetin"),
    ("热量限制", "caloric_restriction"),
    ("限食", "caloric_restriction"),
    ("规律运动", "exercise"),
    ("运动", "exercise"),
]

DISPLAY = {
    "Aspirin": "阿司匹林",
    "Metformin": "二甲双胍",
    "Rapamycin": "雷帕霉素",
    "Resveratrol": "白藜芦醇",
    "Spermidine": "亚精胺",
    "Quercetin": "槲皮素",
    "Fisetin": "非瑟酮",
    "Nicotinamide": "烟酰胺",
    "Nicotinamide mononucleotide": "烟酰胺单核苷酸",
    "Nicotinamide riboside": "烟酰胺核糖",
    "Acarbose": "阿卡波糖",
    "Curcumin": "姜黄素",
    "Vitamin D3": "维生素D3",
}

_FORMS = ("肠溶片", "缓释片", "咀嚼片", "分散片", "胶囊", "颗粒", "滴丸", "片")


def normalize(name: str) -> str:
    text = name.casefold().replace(" ", "")
    text = re.sub(r"[\d.]+\s*(mg|g|ml|μg|ug|iu).*$", "", text)
    for suffix in _FORMS:
        if text.endswith(suffix):
            text = text[: -len(suffix)]
    return text


def display_name(compound: str) -> str:
    return DISPLAY.get(compound, compound)


def match_drugage(user_name: str, by_name: dict[str, CompoundScore]) -> CompoundScore | None:
    folded = {key.lower(): value for key, value in by_name.items()}
    direct = normalize(user_name)
    if direct in folded:
        return folded[direct]
    for alias, canonical in sorted(ALIASES, key=lambda item: len(item[0]), reverse=True):
        needle = normalize(alias)
        if needle and (direct == needle or needle in direct):
            return folded.get(canonical.lower())
    return None


def match_interventions(user_name: str) -> list[str]:
    direct = normalize(user_name)
    found: list[str] = []
    for alias, key in sorted(INTERVENTION_ALIASES, key=lambda item: len(item[0]), reverse=True):
        needle = normalize(alias)
        if needle and (direct == needle or needle in direct) and key not in found:
            found.append(key)
    return found
