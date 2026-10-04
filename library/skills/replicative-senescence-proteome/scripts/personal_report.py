#!/usr/bin/env python3
"""Look up user symbols in the frozen equal-cell senescence proteome subset."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

from paper_card import lines as paper_card_lines
from presets import BOUNDARY, N_FROZEN, TABLE_SOURCE, load_table

TITLE = "# 复制性衰老蛋白质组查表"


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
    """Return ordered unique query strings from measurements file."""
    if path is None:
        return []
    text = path.read_text(encoding="utf-8-sig")
    if not text.strip():
        return []
    # Try CSV first
    rows = read_rows(path)
    queries = []
    if rows:
        fields = {((k or "").strip().lower()): k for k in rows[0].keys() if k}
        name_key = fields.get("name") or fields.get("item") or fields.get("项目")
        value_key = fields.get("value") or fields.get("结果") or fields.get("symbol") or fields.get("gene") or fields.get("uniprot")
        symbol_only = fields.get("symbol") or fields.get("gene") or fields.get("uniprot") or fields.get("id")
        for row in rows:
            if name_key and value_key and name_key != value_key:
                name = (row.get(name_key) or "").strip().lower()
                val = (row.get(value_key) or "").strip()
                if not val:
                    continue
                if name in {"symbol", "gene", "uniprot", "id", "protein", "蛋白质", "基因"} or name_key:
                    queries.append(val)
            elif symbol_only:
                val = (row.get(symbol_only) or "").strip()
                if val:
                    queries.append(val)
            else:
                # single-column-ish: first non-empty cell
                for v in row.values():
                    if v and str(v).strip():
                        queries.append(str(v).strip())
                        break
    else:
        for line in text.splitlines():
            s = line.strip()
            if s and not s.startswith("#"):
                queries.append(s.split(",")[0].strip())
    # unique preserve order
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


def lookup(query, by_symbol, by_uniprot):
    key = query.strip().upper()
    if key in by_symbol:
        return by_symbol[key]
    if key in by_uniprot:
        return by_uniprot[key]
    return None


def method_lines(queries):
    rows, by_symbol, by_uniprot = load_table()
    lines = ["## 方法算出的名单", ""]
    if not queries:
        lines.append("- 没有提供基因或 UniProt 名单，所以没有查表命中。")
        intro = "请在 measurements 里交 symbol 或 uniprot。"
        return intro, lines

    hits = 0
    for q in queries:
        entry = lookup(q, by_symbol, by_uniprot)
        if entry is None:
            lines.append(f"- {q}：不在冻结的 equal-cell 显著性子集（{N_FROZEN} 个蛋白）里。")
            continue
        hits += 1
        fc = entry["log2_age4_over_age1"]
        adj = entry["adj_p_val"]
        cluster = entry["cluster"]
        sym = entry["symbol"]
        uid = entry["uniprot_id"]
        lines.append(
            f"- {q} → {sym} ({uid})：{cluster}；mean log2(Age4/Age1)={fc}；adj.P.Val={adj}。"
        )
    intro = (
        f"按 {TABLE_SOURCE} 查了 {len(queries)} 个标识符，命中 {hits} 个。"
        "这是论文 equall-cell 实验里的蛋白变化标签，不是你的个人衰老分数。"
    )
    # fix typo equall -> equal
    intro = intro.replace("equall-cell", "equal-cell")
    return intro, lines


def cannot_lines():
    return [
        "## 这次算不了",
        "",
        "- 把你的血检或任意丰度表算成个人衰老分数。补充表与代码仓库都没有个人时钟系数。",
        "- `Proteome_Z_Score_and_clusters` 的 K-means Clusters（Late/Steady gain/loss）。Description 写了该列，打开后该 sheet 实际没有 Clusters 列。",
        "- Supplementary Data 2–9（转录组、SUMO、泛素、溶解度、应激原）未冻进这次查表。",
    ]


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
