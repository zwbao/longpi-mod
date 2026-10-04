#!/usr/bin/env python3
"""Look up genes in frozen RamanOmics p21+ senescence DEG subset."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, N_FROZEN, TABLE_SOURCE, load_table

TITLE = "# RamanOmics 衰老差异基因查表"


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


def load_queries(path):
    if path is None:
        return []
    text = path.read_text(encoding="utf-8-sig")
    if not text.strip():
        return []
    rows = read_rows(path)
    queries = []
    if rows:
        fields = {((k or "").strip().lower()): k for k in rows[0].keys() if k}
        name_key = fields.get("name") or fields.get("item") or fields.get("项目")
        value_key = fields.get("value") or fields.get("结果") or fields.get("symbol") or fields.get("gene")
        symbol_only = fields.get("symbol") or fields.get("gene") or fields.get("id")
        for row in rows:
            if name_key and value_key and name_key != value_key:
                val = (row.get(value_key) or "").strip()
                if val:
                    queries.append(val)
            elif symbol_only:
                val = (row.get(symbol_only) or "").strip()
                if val:
                    queries.append(val)
            else:
                for v in row.values():
                    if v and str(v).strip():
                        queries.append(str(v).strip())
                        break
    else:
        for line in text.splitlines():
            s = line.strip()
            if s and not s.startswith("#"):
                queries.append(s.split(",")[0].strip())
    seen = set()
    out = []
    for q in queries:
        key = q.upper()
        if key not in seen:
            seen.add(key)
            out.append(q)
    return out


def load_meds(path):
    if path is None:
        return []
    return [ln.strip() for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip() and not ln.startswith("#")]


def lab_lines(path):
    rows = read_rows(path)
    lines = ["## 体检", ""]
    if not rows:
        lines.append("没有提供体检。体检不增删方法算出的名单。")
        return lines
    lines.append("下面照录体检数值。体检不增删方法算出的名单。")
    for row in rows:
        lowered = {(k or "").strip(): (v or "").strip() for k, v in row.items()}
        item = lowered.get("项目") or lowered.get("item") or ""
        value = lowered.get("结果") or lowered.get("value") or lowered.get("result") or ""
        unit = lowered.get("单位") or lowered.get("unit") or ""
        if item and value:
            suffix = f" {unit}" if unit else ""
            lines.append(f"- {item} {value}{suffix}")
    return lines


def medication_lines(meds):
    lines = ["## 你正在使用的药", ""]
    if not meds:
        lines.append("没有提供现用药。不能据此停。")
        return lines
    for name in meds:
        lines.append(f"- {name}：名单里没有这个名字。不能据此停。")
    return lines


def method_lines(queries):
    rows, by_gene = load_table()
    lines = ["## 方法算出的名单", ""]
    if not queries:
        lines.append("- 没有提供基因名单，所以没有查表命中。")
        return "请在 measurements 里交 gene/symbol。", lines
    hits = 0
    for q in queries:
        entries = by_gene.get(q.strip().upper())
        if not entries:
            lines.append(f"- {q}：不在冻结的 {TABLE_SOURCE} 子集（{N_FROZEN} 行）里。")
            continue
        hits += 1
        for entry in entries:
            lines.append(
                f"- {q} → {entry['gene']}（{entry['tissue_context']}）："
                f"avg_log2FC={entry['avg_log2fc']}；p_val_adj={entry['p_val_adj']}。"
            )
    intro = (
        f"按 {TABLE_SOURCE} 查了 {len(queries)} 个基因，命中 {hits} 个。"
        "这是小鼠组织 p21+ DEG 标签，不是你的个人组织衰老诊断。"
    )
    return intro, lines


def cannot_lines():
    return [
        "## 这次算不了",
        "",
        "- 从你的 Raman/光谱文件重算 1131–1135 cm⁻¹ 脂质峰或空间衰老图。仓库不是个人打分器。",
        "- 个人皮肤/肺衰老诊断。DEG 来自小鼠老组织 p21+ 细胞。",
        "- MOESM3 探针序列与 SenNet 原始矩阵未冻进这次查表。",
    ]


def _with_paper_card(text):
    if "## 论文卡片" in text:
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


def render(age, meds, labs, measurements):
    queries = load_queries(measurements)
    intro, listed = method_lines(queries)
    if age is not None:
        intro = f"年龄记下了，不进入查表。{intro}"
    lines = [TITLE, "", intro, ""]
    lines.extend(listed)
    lines.extend(["", *cannot_lines(), "", *medication_lines(load_meds(meds)), "", *lab_lines(labs)])
    lines.extend(["", f"边界: {BOUNDARY}"])
    return "\n".join(lines) + "\n"


def report(out, meds, labs, measurements, age=None):
    out.mkdir(parents=True, exist_ok=True)
    path = out / "report.md"
    path.write_text(_with_paper_card(render(age, meds, labs, measurements)), encoding="utf-8")
    return path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--measurements", type=Path)
    parser.add_argument("--medications", type=Path)
    parser.add_argument("--labs", type=Path)
    parser.add_argument("--age", type=float)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(report(args.out, args.medications, args.labs, args.measurements, args.age))


if __name__ == "__main__":
    main()
