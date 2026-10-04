#!/usr/bin/env python3
from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
from pathlib import Path

from presets import BOUNDARY


def read_rows(path: Path | None) -> list[dict[str, str]]:
    if path is None or not path.exists():
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        if not sample.strip():
            return []
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        return list(csv.DictReader(handle, dialect=dialect))


def load_meds(path: Path | None) -> list[str]:
    if path is None or not path.exists():
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def as_float(text: str | None) -> float | None:
    if text is None:
        return None
    raw = str(text).strip().replace("＋", "+").replace("－", "-")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def lab_lines(path: Path | None) -> list[str]:
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        lowered = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
        item = lowered.get("项目") or lowered.get("item") or lowered.get("name")
        value = lowered.get("结果") or lowered.get("value") or lowered.get("result")
        unit = lowered.get("单位") or lowered.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
        else:
            bits = [f"{key} {val}".strip() for key, val in lowered.items() if key and val]
            if bits:
                lines.append("- " + "，".join(bits))
    return lines


def medication_lines(meds: list[str], known: set[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。")
        return lines
    folded = {name.casefold() for name in known}
    for name in meds:
        if name.casefold() in folded:
            lines.append(f"- {name}：这个名字出现在方法名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def finish(lines: list[str]) -> str:
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def write_report(out: Path, text: str) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(text if text.endswith("\n") else text + "\n"), encoding="utf-8")
    return path



from presets import GROUP_EFFECTS, week32_delta


CLOCK_KEYS = {
    "phenoage": "PhenoAge",
    "pcgrimage": "PCGrimAge",
    "grimagev2": "GrimAgeV2",
    "omicmage": "OMICmAge",
    "retroage": "RetroAge",
    "dunedinpace": "DunedinPACE",
}


def clocks(rows):
    found = []
    seen = set()
    bag = {}
    for row in rows:
        low = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}
        name = low.get("clock")
        baseline = as_float(low.get("baseline"))
        week32 = as_float(low.get("week32"))
        if name and baseline is not None and week32 is not None:
            found.append((name, week32_delta(baseline, week32)))
            seen.add(name)
            continue
        item = low.get("item") or low.get("marker") or low.get("name") or ""
        if item and "value" in low and "baseline" not in low:
            bag[item.lower().replace("-", "").replace("_", "")] = as_float(low.get("value"))
    for key, display in CLOCK_KEYS.items():
        if display in seen:
            continue
        baseline = bag.get(key + "baseline")
        week32 = bag.get(key + "week32")
        if baseline is not None and week32 is not None:
            found.append((display, week32_delta(baseline, week32)))
    return found


def comparison(name, delta):
    effect = GROUP_EFFECTS.get(name)
    base = f"{name} 从基线到第 32 周的变化是 {delta:.1f}"
    if effect is None:
        return f"{base}。论文摘要没有写出这个时钟的组间数字。"
    unit = f" {effect['unit']}" if effect.get("unit") else ""
    return f"{base}。论文里这个时钟的组间差别是 {effect['estimate']}{unit}，那是组间数字，不是你的变化。"


def opening(rows):
    found = clocks(rows)
    if not found:
        return "没有同时提供某个时钟的基线和第 32 周数值，所以这次没有算出变化。组间差别不是个人权重。"
    parts = [comparison(name, delta) for name, delta in found]
    return "这次算出" + "".join(" " + part for part in parts)


def method_lines(rows):
    found = {name: delta for name, delta in clocks(rows)}
    lines = ["## 方法算出的名单", ""]
    for name in GROUP_EFFECTS:
        if name in found:
            lines.append(f"- {name}：32 周变化是 {found[name]:.1f}。")
        else:
            lines.append(f"- {name}")
    for name, delta in found.items():
        if name not in GROUP_EFFECTS:
            lines.append(f"- {name}：32 周变化是 {delta:.1f}。")
    return lines


def known_names(rows):
    return {name for name, _delta in clocks(rows)}


def render(meds, labs, rows):
    lines = ["# 表观遗传时钟变化", "", opening(rows), ""]
    lines.extend(method_lines(rows))
    lines.extend(["", *medication_lines(meds, known_names(rows))])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out, meds, labs, measurements):
    return write_report(out, render(load_meds(meds), labs, read_rows(measurements)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.medications, args.labs, args.measurements))



def _with_paper_card(text):
    if not isinstance(text, str) or "## 论文卡片" in text:
        return text
    rows = text.splitlines()
    if not rows or not rows[0].startswith("# "):
        return text
    rest = rows[1:]
    while rest and rest[0] == "":
        rest = rest[1:]
    merged = [rows[0], "", *paper_card_lines(), "", *rest]
    out = "\n".join(merged)
    if text.endswith("\n"):
        out += "\n"
    return out

if __name__ == "__main__":
    main()
