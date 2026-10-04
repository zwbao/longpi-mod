#!/usr/bin/env python3
"""Personal readout for the hip-fracture proteomic risk score."""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import argparse
import csv
from pathlib import Path

from presets import BOUNDARY, ELASTIC, LASSO, WEIGHTED, ebmd, score_panel

PANELS = (
    ("加权蛋白风险分", WEIGHTED),
    ("套索蛋白风险分", LASSO),
    ("弹性网蛋白风险分", ELASTIC),
)

EXCLUDE_FLAGS = {"deprecated", "nonhuman", "non-human", "poor_quality", "poor-quality"}


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


def parse_measurements(rows: list[dict[str, str]]) -> tuple[dict[str, float], float | None, float | None]:
    proteins: dict[str, float] = {}
    bua = None
    sos = None
    for row in rows:
        keys = {(k or "").strip().lower(): (v or "").strip() for k, v in row.items() if k}
        name = keys.get("item") or keys.get("name") or keys.get("protein") or ""
        value = keys.get("value") or keys.get("rfu") or keys.get("npx") or ""
        flag = (keys.get("flag") or keys.get("status") or "").lower()
        if not name:
            continue
        lowered = name.lower()
        if lowered == "bua":
            bua = as_float(value)
            continue
        if lowered == "sos":
            sos = as_float(value)
            continue
        if flag in EXCLUDE_FLAGS:
            continue
        number = as_float(value)
        if number is None:
            continue
        proteins[name] = number
    return proteins, bua, sos


def panel_hits(rows: list[dict[str, str]]):
    proteins, bua, sos = parse_measurements(rows)
    pairs = list(proteins.items())
    found = []
    for label, panel in PANELS:
        hit = score_panel(panel, pairs)
        if hit is not None:
            found.append((label, hit[0], hit[1]))
    return found, bua, sos


def opening(rows: list[dict[str, str]]) -> str:
    found, bua, sos = panel_hits(rows)
    parts: list[str] = []
    if bua is not None and sos is not None:
        parts.append(f"这次算出超声骨密度是 {ebmd(bua, sos):.4f}。")
    if not found:
        if bua is None or sos is None:
            return "没有对上蛋白风险分里的蛋白，也没有足跟超声的两个读数，所以这次没有算出蛋白风险分，也没有算出超声骨密度。"
        parts.append("蛋白风险分没有算出。")
        return "".join(parts)
    bits = "，".join(f"{label}是 {total:.4f}" for label, total, _hits in found)
    parts.append(f"这次算出{bits}。没测到的蛋白按 0 代入，系数按每个标准差计。")
    return "".join(parts)


def method_lines(rows: list[dict[str, str]]) -> list[str]:
    found, bua, sos = panel_hits(rows)
    lines = ["## 方法算出的名单", ""]
    if bua is None or sos is None:
        lines.append("- 超声骨密度：这次没有算出。")
    else:
        lines.append(f"- 超声骨密度：{ebmd(bua, sos):.4f}。")
    if not found:
        lines.append("- 蛋白风险分：没有可以写出的蛋白名字。")
        return lines
    for label, total, hits in found:
        names = "、".join(zh for zh, _value in hits)
        lines.append(f"- {label}：{total:.4f}。对上的是{names}。")
    return lines


def medication_lines(meds: list[str]) -> list[str]:
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。")
        return lines
    for name in meds:
        lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


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


def finish(lines: list[str]) -> str:
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def render(meds: list[str], labs: Path | None, rows: list[dict[str, str]]) -> str:
    lines = ["# 髋部骨折蛋白读出", "", opening(rows), ""]
    lines.extend(method_lines(rows))
    lines.extend(["", *medication_lines(meds)])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out: Path, meds: Path | None, labs: Path | None, measurements: Path | None) -> Path:
    text = render(load_meds(meds), labs, read_rows(measurements))
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def main() -> None:
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
