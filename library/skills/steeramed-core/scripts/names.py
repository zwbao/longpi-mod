"""Readable compound names and matching against a person's current medicines."""

from __future__ import annotations

import re

# Spoken Chinese names to English aliases that STITCH is likely to carry.
CHINESE_DRUG_NAMES = {
    "阿司匹林": "aspirin",
    "烟酸": "niacin",
    "烟酰胺": "nicotinamide",
    "二甲双胍": "metformin",
    "叶酸": "folic acid",
    "维生素d": "vitamin d",
    "维生素d3": "cholecalciferol",
    "维生素e": "vitamin e",
    "秋水仙碱": "colchicine",
    "褪黑素": "melatonin",
    "亚精胺": "spermidine",
    "白藜芦醇": "resveratrol",
    "肌酸": "creatine",
    "肌醇": "inositol",
    "甲氨蝶呤": "methotrexate",
    "泼尼松": "prednisone",
    "吡罗昔康": "piroxicam",
    "布洛芬": "ibuprofen",
    "对乙酰氨基酚": "acetaminophen",
    "氯喹": "chloroquine",
    "羟氯喹": "hydroxychloroquine",
    "雷帕霉素": "rapamycin",
    "辛伐他汀": "simvastatin",
    "阿托伐他汀": "atorvastatin",
    "氨氯地平": "amlodipine",
    "缬沙坦": "valsartan",
    "美托洛尔": "metoprolol",
    "奥美拉唑": "omeprazole",
    "氯吡格雷": "clopidogrel",
    "华法林": "warfarin",
}


def normalize_sex(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip().casefold()
    if text in {"m", "male", "男"}:
        return "M"
    if text in {"f", "female", "女"}:
        return "F"
    if text == "":
        return None
    return value.strip()[:1].upper()


def medication_queries(name: str) -> list[str]:
    text = name.strip()
    text = re.sub(r"(肠溶片|缓释片|片|胶囊|颗粒|滴丸|注射液|软膏)$", "", text).strip()
    queries = [text.casefold()]
    mapped = CHINESE_DRUG_NAMES.get(text.casefold()) or CHINESE_DRUG_NAMES.get(text)
    if mapped:
        queries.append(mapped.casefold())
    return [query for query in queries if query]


def medication_match(name: str, compound_name: str, compound_id: str, aliases: list[str]) -> bool:
    keys = {compound_name.casefold(), compound_id.casefold()}
    keys.update(alias.casefold() for alias in aliases if alias)
    for query in medication_queries(name):
        if query in keys:
            return True
        for key in keys:
            if len(query) >= 3 and len(key) >= 3 and (query in key or key in query):
                return True
    return False
