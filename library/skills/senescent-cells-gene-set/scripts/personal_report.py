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


SAMPLE_MEASUREMENTS = """gene,value
IL6,8
CCL2,5
ACTB,1
"""


TITLE = "# 衰老相关基因"

def readable_gene(symbol):
    from presets import CLASS_ZH, GENE_CLASS, GENE_ZH
    return f"{symbol} {GENE_ZH[symbol]}，{CLASS_ZH[GENE_CLASS[symbol]]}"


def list_names(kv):
    from presets import SENMAYO
    keys = {k.upper() for k in kv}
    return [gene for gene in SENMAYO if gene in keys]


def matched_genes(kv):
    from presets import SENMAYO
    upper = {}
    for key, value in kv.items():
        if key.upper() in SENMAYO or key in SENMAYO:
            upper[key.upper()] = as_float(value)
    present = [(gene, upper[gene]) for gene in SENMAYO if gene in upper and upper[gene] is not None]
    present.sort(key=lambda item: (-item[1], item[0]))
    other = []
    for key, value in kv.items():
        if key.upper() not in SENMAYO and key not in SENMAYO:
            number = as_float(value)
            if number is not None:
                other.append(number)
    return present, other


def method_lines(kv, age):
    del age
    present, other = matched_genes(kv)
    from presets import N_GENES
    lines = ["## 方法算出的名单", "", "下面是对上的基因。这些是基因，不是药。没有另造权重。"]
    if not present:
        return "这次没有对上的基因表达，所以没有算出名单。", [
            "## 方法算出的名单",
            "",
            "没有对上的基因。",
        ]
    for gene, value in present:
        lines.append(f"- {readable_gene(gene)}。表达 {value:g}。")
    if other:
        score = sum(value for _, value in present) / len(present) - sum(other) / len(other)
        intro = (
            f"这次对上 {len(present)} 个衰老相关基因，集合共 {N_GENES} 个。"
            f"平均表达减去其余已测基因的平均表达，差是 {score:.4f}。"
        )
        lines.append(f"没有权重的平均表达差是 {score:.4f}。")
    else:
        intro = f"这次对上 {len(present)} 个衰老相关基因，集合共 {N_GENES} 个。除这些基因外没有其他已测基因，所以没有算平均差。"
    return intro, lines


def extra_checks(text):
    from presets import CLASS_ZH, EXCLUDED, GENE_CLASS, GENE_ZH, N_GENES, SENMAYO
    assert len(SENMAYO) == N_GENES == 125
    assert len(set(SENMAYO)) == 125
    assert set(GENE_ZH) == set(SENMAYO) == set(GENE_CLASS)
    assert set(GENE_CLASS.values()) <= set(CLASS_ZH)
    for gene in EXCLUDED:
        assert gene not in SENMAYO
    assert "IL6" in SENMAYO and "CCL2" in SENMAYO
    assert "白细胞介素 6" in text
    assert "趋化因子配体 2" in text
    assert "125" in text
    assert "5.5000" in text
    assert "0.0052" not in text
    assert "GSE" not in text




def render(age, meds, labs, measurements):
    kv = load_kv(measurements)
    intro, listed = method_lines(kv, age)
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
    path = report(args.out, args.medications, args.labs, args.measurements, args.age)
    print(path)



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
