"""Maximum lifespans printed in Table 1. Gompertz alpha and beta are not stored here.

doi:10.1038/s41467-026-73635-7. Table 1 lists one maximum lifespan in days for each species.
The Gompertz hazard is mu(x) = alpha * exp(beta * x). The survival function is stated in Methods.
Point estimates of alpha and beta are discussed as being in Tables 2-4; those columns are not in
Supplementary Data sheets of MOESM3.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "蝶类寿命记录"

# Methods: BaSTA used this many butterflies after exclusions. Stays out of the report.
COHORT_N = 941

# Table 1. Maximum reported lifespan (days), feeding habit.
TABLE1 = {
    "heliconius hewitsoni": (348, "花粉取食"),
    "heliconius hecale": (277, "花粉取食"),
    "heliconius erato": (274, "花粉取食"),
    "heliconius melpomene": (260, "花粉取食"),
    "heliconius ismenius": (245, "花粉取食"),
    "heliconius cydno": (244, "花粉取食"),
    "heliconius atthis": (210, "花粉取食"),
    "heliconius numata": (210, "花粉取食"),
    "heliconius hortense": (198, "花粉取食"),
    "heliconius charithonia": (184, "花粉取食"),
    "heliconius sapho": (177, "花粉取食"),
    "heliconius sara": (170, "花粉取食"),
    "heliconius ethilla": (162, "花粉取食"),
    "heliconius clysonymus": (156, "花粉取食"),
    "heliconius himera": (155, "花粉取食"),
    "heliconius hermathena": (139, "花粉取食"),
    "heliconius pachinus": (106, "花粉取食"),
    "dryas iulia": (98, "不取食花粉"),
    "heliconius hecalesia": (89, "花粉取食"),
    "heliconius eleuchia": (86, "花粉取食"),
    "dryadula phaetusa": (85, "不取食花粉"),
    "heliconius nattereri": (77, "花粉取食"),
    "heliconius doris": (69, "花粉取食"),
    "heliconius xanthocles": (66, "花粉取食"),
    "agraulis vanillae": (60, "不取食花粉"),
    "eueides isabella": (46, "不取食花粉"),
    "philaethria dido": (44, "不取食花粉"),
    "dione juno": (14, "不取食花粉"),
}

GENUS = {
    "h": "heliconius",
    "d": "dryas",
    "di": "dione",
    "dr": "dryadula",
    "a": "agraulis",
    "e": "eueides",
    "p": "philaethria",
}

MISSING = (
    "不能算存活概率或死亡概率。已打开的 41467_2026_73635_MOESM3_ESM.xlsx 各表是寿命记录、"
    "体重和握力，没有 Gompertz 的 α 列和 β 列。正文把这两列放在表二到表四，单元格没有随正文抽出。"
)


def lookup_species(raw: str) -> tuple[str, int, str] | None:
    text = " ".join(raw.replace(".", " ").replace("_", " ").lower().split())
    if text in TABLE1:
        days, habit = TABLE1[text]
        return text, days, habit
    parts = text.split()
    if len(parts) == 2 and parts[0] in GENUS:
        full = f"{GENUS[parts[0]]} {parts[1]}"
        if full in TABLE1:
            days, habit = TABLE1[full]
            return full, days, habit
    return None


def build(measurements: dict[str, str], age: float | None) -> tuple[str, list[str]]:
    raw = measurements.get("species") or measurements.get("种") or ""
    found = lookup_species(raw) if raw else None
    items = ["能算的：", ""]
    if found is None:
        items.append("没有对上表一里的种名，最长寿命记录不算。")
        lead = "这次没有对上表一里的种名。"
    else:
        name, days, habit = found
        items.append(f"- {name}：表一的最长寿命是 {days} 天，取食习惯是{habit}。")
        if age is None:
            items.append("没有给出成虫日龄。")
            lead = "这次对照了表一的最长寿命记录。"
        else:
            items.append(f"- 你给出的成虫日龄是 {age:g} 天。这不是死亡概率。")
            lead = "这次把成虫日龄放在表一的最长寿命记录旁边。"
    items.extend(["", "不能算的：", "", MISSING])
    return lead, items
