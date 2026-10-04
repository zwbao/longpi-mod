#!/usr/bin/env python3
from __future__ import annotations

import skillkit
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



from presets import sleep_bin


def collect_inputs(measurements: Path | None) -> tuple[float | None, list]:
    """Read sleep hours through skill.json: names, units, and range.

    Returns the hours and the problems that stop the grouping (unknown unit,
    out of range, unparsable, duplicated). Missing hours are not a problem
    here; the report says no hours were given, as before. A measurements path
    that does not exist counts as no measurements, as before.
    """
    manifest = skillkit.load_manifest(__file__)
    if measurements is not None and not measurements.exists():
        measurements = None
    collected = skillkit.collect_file(measurements, manifest)
    problems = [item for item in collected.problems if item.kind != "missing"]
    return collected.values.get("sleep_hours"), problems


def opening(hours):
    if hours is None:
        return "没有提供睡眠小时数，所以这次没有分组。"
    return f"这次把睡眠时长放进「{sleep_bin(hours)}」组。"


def method_lines(hours):
    label = sleep_bin(hours) if hours is not None else None
    lines = ["## 方法算出的名单", ""]
    for name in ("短睡眠", "正常睡眠", "长睡眠"):
        if label is not None and name.startswith(label):
            lines.append(f"- {name}：这次落在这里。")
        else:
            lines.append(f"- {name}")
    return lines


def known_names(_hours):
    return set()


def render(meds, labs, hours):
    lines = ["# 睡眠时长分组", "", opening(hours), ""]
    lines.extend(method_lines(hours))
    lines.extend(["", *medication_lines(meds, known_names(hours))])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out, meds, labs, measurements):
    out.mkdir(parents=True, exist_ok=True)
    stale = out / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    hours, problems = collect_inputs(measurements)
    if problems:
        path = skillkit.write_problems(out, problems, "睡眠时长分组", BOUNDARY)
        text = path.read_text(encoding="utf-8").replace(
            "这次没有计算。原因如下：", "输入没有通过检查，所以这次没有分组。原因如下："
        )
        path.write_text(_with_paper_card(text), encoding="utf-8")
        skillkit.write_result(out, manifest, {"sleep_duration_bin": None})
        return path
    path = write_report(out, render(load_meds(meds), labs, hours))
    skillkit.write_result(out, manifest, {
        "sleep_duration_bin": sleep_bin(hours) if hours is not None else None,
    })
    return path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    print(report(args.out, args.medications, args.labs, args.measurements))
    if (args.out / "problems.json").exists():
        return skillkit.EXIT_INPUT_PROBLEM
    return 0



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
    raise SystemExit(main())
