#!/usr/bin/env python3
"""Look up what the collected papers state about a drug, supplement, gene or other entity.

Rows come from data/claims.jsonl, copied from the frozen lists of the skills in
this repository (never inferred). The report groups them by evidence: human
studies first, then animal and cell experiments, and cites every row. Nothing
here is a recommendation; a name that is not collected is not evidence of
safety or of no effect.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import OrderedDict
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import skillkit

HERE = Path(__file__).resolve().parent.parent
CLAIMS = HERE / "data" / "claims.jsonl"
TITLE = "证据查询"
BOUNDARY = (
    "这是已收录论文对这些对象的原话整理，不是用药、补剂或饮食建议。"
    "动物和细胞结果不能直接当成人的效果或剂量。名单里没有某个名字，不是停用的理由，也不说明它安全或无效。"
)
HUMAN_DESIGNS = {"rct", "cohort", "case_control", "cross_sectional"}
BUCKETS = OrderedDict([
    ("human", "人群研究"),
    ("animal", "动物实验"),
    ("cell", "细胞实验"),
    ("other", "综述、方法与数据库"),
])
TYPE_ZH = {
    "gene": "基因", "protein": "蛋白", "compound": "化合物", "drug": "药物", "supplement": "补剂",
    "intervention": "干预", "metabolite": "代谢物", "variant": "变异", "cell_type": "细胞类型",
    "pathway": "通路", "biomarker": "标志物", "microbe": "微生物", "other": "其他",
}
DESIGN_ZH = {
    "rct": "随机对照试验", "cohort": "队列研究", "case_control": "病例对照", "cross_sectional": "横断面研究",
    "animal": "动物实验", "in_vitro": "细胞实验", "review": "综述", "method": "方法研究", "database": "数据库",
}
MAX_ROWS_PER_BUCKET = 12
# Within human studies, trials first, then prospective cohorts, then weaker designs.
DESIGN_RANK = {"rct": 0, "cohort": 1, "case_control": 2, "cross_sectional": 3}


def fold(text: str) -> str:
    text = unicodedata.normalize("NFKC", str(text)).casefold()
    return re.sub(r"[\s_\-·•'’()（）\[\]]+", "", text)


def load_claims(path: Path = CLAIMS) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def names_of(row: Dict[str, Any]) -> List[str]:
    return [name for name in [row.get("entity", ""), row.get("entity_zh", ""), *row.get("aliases", [])] if name]


def search(rows: Sequence[Dict[str, Any]], query: str) -> List[Dict[str, Any]]:
    """Rows whose entity, Chinese name or alias equals the query; else contains it."""
    wanted = fold(query)
    if not wanted:
        return []
    exact = [row for row in rows if any(fold(name) == wanted for name in names_of(row))]
    if exact:
        return exact
    if len(wanted) < 3:
        return []
    return [row for row in rows if any(wanted in fold(name) for name in names_of(row) if len(fold(name)) >= 3)]


def bucket(row: Dict[str, Any]) -> str:
    species = set(row.get("species", []))
    design = row.get("evidence", "")
    if "human" in species and design in HUMAN_DESIGNS:
        return "human"
    if design == "in_vitro" or species == {"cell_line"}:
        return "cell"
    if design == "animal" or (species - {"human", "cell_line"}):
        return "animal"
    return "other"


def paper_label(skill: str, doi: str, source: Optional[Dict[str, Any]] = None) -> str:
    manifest = HERE.parent / skill / "skill.json"
    parts = []
    paper = json.loads(manifest.read_text(encoding="utf-8")).get("paper", {}) if manifest.exists() else {}
    if not paper and source:
        paper = {"title_zh": source.get("title", ""), "journal": source.get("journal", ""), "year": source.get("year", "")}
    if paper:
        head = "，".join(str(part) for part in (paper.get("journal", ""), paper.get("year", "")) if part)
        if paper.get("title_zh"):
            parts.append(f"{paper['title_zh']}（{head}）" if head else paper["title_zh"])
    if doi:
        parts.append(f"[DOI](https://doi.org/{doi})")
    parts.append(f"`skills/{skill}/`")
    return "，".join(parts)


def row_line(row: Dict[str, Any]) -> str:
    name = row.get("entity_zh") or row["entity"]
    if row.get("entity_zh") and row["entity_zh"] != row["entity"]:
        name = f"{row['entity_zh']}（{row['entity']}）"
    kind = TYPE_ZH.get(row.get("entity_type", "other"), "其他")
    design = DESIGN_ZH.get(row.get("evidence", ""), "")
    source = row.get("source", {})
    where = paper_label(source.get("skill", ""), source.get("doi", ""), source)
    locator = f"，{source['locator']}" if source.get("locator") else ""
    context = f"（{row['context_zh']}）" if row.get("context_zh") else ""
    return f"- **{name}**，{kind}，{design}{context}：{row['claim_zh']} 出处：{where}{locator}。"


def render(queries: List[str], found: Dict[str, List[Dict[str, Any]]], medications: List[str],
           med_found: Dict[str, List[Dict[str, Any]]], total: int, skills: int) -> str:
    lines = [f"# {TITLE}", "", "## 证据库", "",
             f"证据库收录 {total} 条说法，来自本仓库 {skills} 个技能的论文。每条照录论文点名的对象和方向，不是综述结论，也不是效果大小。", ""]
    for query in queries:
        rows = found.get(query, [])
        lines += [f"## 查询：{query}", ""]
        if not rows:
            lines += [f"证据库里没有「{query}」。没有收录不等于没有研究，也不说明它安全或无效。"
                      "可以再查 Evipedia 的证据综述（`skills/evipedia/`）或按 AI4L 协议写综述（`skills/ai4l/`）。", ""]
            continue
        grouped: Dict[str, List[Dict[str, Any]]] = OrderedDict((key, []) for key in BUCKETS)
        for row in rows:
            grouped[bucket(row)].append(row)
        if not grouped["human"]:
            lines += ["收录的论文里没有关于它的人群研究，下面只有动物、细胞或数据库里的说法。", ""]
        grouped["human"].sort(key=lambda row: DESIGN_RANK.get(row.get("evidence", ""), 9))
        for key, label in BUCKETS.items():
            items = grouped[key]
            if not items:
                continue
            if key == "human":
                designs = OrderedDict()
                for row in items:
                    name = DESIGN_ZH.get(row.get("evidence", ""), "其他")
                    designs[name] = designs.get(name, 0) + 1
                breakdown = "，".join(f"{name} {count}" for name, count in designs.items())
                lines += [f"### {label}（{len(items)} 条：{breakdown}；按证据强度排列）", ""]
            else:
                lines += [f"### {label}（{len(items)} 条）", ""]
            lines += [row_line(row) for row in items[:MAX_ROWS_PER_BUCKET]]
            if len(items) > MAX_ROWS_PER_BUCKET:
                lines.append(f"- 另有 {len(items) - MAX_ROWS_PER_BUCKET} 条同类说法没有列出。")
            lines.append("")
    if medications:
        lines += ["## 你正在使用的药", ""]
        for name in medications:
            count = len(med_found.get(name, []))
            note = f"证据库里有 {count} 条说法。" if count else "证据库里没有收录。"
            lines.append(f"- {name}：{note}不能据此停。")
        lines.append("")
    lines.append(f"边界: {BOUNDARY}")
    return "\n".join(lines) + "\n"


def load_lines(path: Optional[Path]) -> List[str]:
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8", errors="replace").splitlines()
            if line.strip() and not line.startswith("#")]


def run(queries: List[str], medications: List[str], out_dir: Path, claims_path: Path = CLAIMS) -> int:
    rows = load_claims(claims_path)
    found = OrderedDict((query, search(rows, query)) for query in queries)
    med_found = {name: search(rows, name) for name in medications}
    skills = len({row.get("source", {}).get("skill") for row in rows})
    out_dir.mkdir(parents=True, exist_ok=True)
    report = out_dir / "report.md"
    report.write_text(render(queries, found, medications, med_found, len(rows), skills), encoding="utf-8")
    matched = [row for group in found.values() for row in group]
    skillkit.write_result(out_dir, skillkit.load_manifest(__file__), {
        "match_count": len(matched),
        "human_count": sum(1 for row in matched if bucket(row) == "human"),
    })
    sys.stdout.write(str(report) + "\n")
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Query the longevity evidence store")
    parser.add_argument("--entity", action="append", default=[], help="drug, supplement, gene, protein or intervention; repeatable")
    parser.add_argument("--medications", type=Path, help="one medicine name per line; each is looked up too")
    parser.add_argument("--claims", type=Path, default=CLAIMS)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    queries = [item.strip() for item in args.entity if item.strip()]
    medications = load_lines(args.medications)
    if not queries and not medications:
        parser.error("give at least one --entity or --medications")
    return run(queries, medications, args.out, args.claims)


if __name__ == "__main__":
    raise SystemExit(main())
