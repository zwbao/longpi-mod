#!/usr/bin/env python3
"""Personal readout. Published numbers live in presets.py."""

from __future__ import annotations

from paper_card import lines as paper_card_lines


import csv
from pathlib import Path

from presets import BOUNDARY


def read_rows(path):
    if path is None:
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        if not sample.strip():
            return []
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t")
        return list(csv.DictReader(handle, dialect=dialect))


def load_kv(path):
    rows = read_rows(path)
    out = {}
    if not rows:
        return out
    fields = {name.strip().lower(): name for name in rows[0].keys() if name}
    if "item" in fields and "value" in fields:
        for row in rows:
            key = (row.get(fields["item"]) or "").strip()
            if key:
                out[key] = (row.get(fields["value"]) or "").strip()
        return out
    if "gene" in fields:
        value_key = "value" if "value" in fields else ("expression" if "expression" in fields else None)
        for row in rows:
            key = (row.get(fields["gene"]) or "").strip()
            if key and value_key:
                out[key] = (row.get(fields[value_key]) or "").strip()
        return out
    if len(rows) == 1:
        return {key.strip(): (value or "").strip() for key, value in rows[0].items() if key}
    return out


def load_meds(path):
    if path is None:
        return []
    names = []
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if text and not text.startswith("#"):
            names.append(text)
    return names


def lab_lines(path):
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        lowered = { (k or "").strip(): (v or "").strip() for k, v in row.items() }
        item = lowered.get("项目") or lowered.get("item") or ""
        value = lowered.get("结果") or lowered.get("value") or lowered.get("result") or ""
        unit = lowered.get("单位") or lowered.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
        else:
            bits = [f"{key} {value}".strip() for key, value in lowered.items() if key and value]
            if bits:
                lines.append("- " + "，".join(bits))
    return lines


def medication_lines(meds, names):
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    known = {name.casefold() for name in names}
    for name in meds:
        if name.casefold() in known:
            lines.append(f"- {name}：这个名字出现在名单里。不能据此停。")
        else:
            lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def write_report(out, text):
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    if not text.endswith("\n"):
        text += "\n"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    return path


def finish(lines):
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def as_float(text):
    if text is None:
        return None
    raw = str(text).strip().replace("＋", "+").replace("－", "-")
    if raw == "":
        return None
    try:
        return float(raw)
    except ValueError:
        return None



SAMPLE_MEASUREMENTS = """item,value
apoe,e3/e4
TBCA,0.4
ARL2,-0.2
"""

TITLE = "# 载脂蛋白相关的血清蛋白"

NAMED = ("TBCA", "ARL2", "S100A13", "IRF6")
PROTEIN_ZH = {
    "TBCA": "微管蛋白折叠辅助因子 A",
    "ARL2": "ADP 核糖基化因子样蛋白 2",
    "S100A13": "S100 钙结合蛋白 A13",
    "IRF6": "干扰素调节因子 6",
}


def list_names(kv):
    return list(NAMED)


def apoe_kind(raw):
    text = (raw or "").lower().replace("ε", "e").replace(" ", "")
    if text in {"", "none"}:
        return "missing"
    if "e2" in text and "e4" in text:
        return "both"
    if "e4" in text:
        return "e4"
    return "other"


def method_lines(kv, age, rows=None):
    del age, rows
    kind = apoe_kind(kv.get("apoe"))
    supplied = [gene for gene in NAMED if kv.get(gene)]
    lines = ["## 方法算出的名单", ""]
    for gene in NAMED:
        label = f"{gene} {PROTEIN_ZH[gene]}"
        if kv.get(gene):
            lines.append(f"- {label}。你的数值是 {kv[gene]}。")
        else:
            lines.append(f"- {label}。这份表没有数值。")
    if kind == "missing" and not supplied:
        intro = "这次没有基因型和这四个蛋白的数值，所以没有照录方向。"
    elif kind == "e4":
        intro = "这次没有风险分。基因型含 ε4。论文写这四个蛋白被这种基因型下调，又因晚发阿尔茨海默病上调。数值只照录，不乘权重。"
    elif kind == "both":
        intro = "这次没有风险分。基因型里同时有 ε2 和 ε4。论文有一个模型排除了这种组合，这次不套那个模型，也不乘权重。"
    elif kind == "other":
        intro = "这次没有风险分。基因型里没有看到 ε4。数值只照录，不乘权重。"
    else:
        intro = "这次没有基因型。你给了蛋白数值，只照录，不乘权重。"
    return intro, lines


def extra_checks(text):
    from presets import DEPENDENT_N, INDEPENDENT_N, PROTEIN_N
    assert PROTEIN_N == 303 and DEPENDENT_N == 17 and INDEPENDENT_N == 140
    for gene in NAMED:
        assert gene in text
    assert "ε4" in text
    assert "不乘权重" in text
    assert "5127" not in text


def render(age, meds, labs, measurements):
    kv = load_kv(measurements)
    rows = read_rows(measurements)
    intro, listed = method_lines(kv, age, rows)
    lines = [TITLE, "", intro, ""]
    lines.extend(listed)
    lines.extend(["", *medication_lines(meds, list_names(kv))])
    lines.extend(["", *lab_lines(labs)])
    return finish(lines)


def report(out, meds, labs, measurements, age=None):
    text = render(age, load_meds(meds), labs, measurements)
    return write_report(out, text)


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.medications, args.labs, args.measurements, args.age))



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
