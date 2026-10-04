#!/usr/bin/env python3
"""CPIC drug-gene lookup for one person's consumer genotype file.

Reads a 23andMe-style raw file (and/or star-allele results from a clinical
test), calls CPIC diplotypes and phenotypes for the genes an array can type,
and looks up the CPIC recommendation rows for the covered drugs. The report
words each row as one of four categories and never prints a dose.
"""

from __future__ import annotations

import argparse
import re
import sys
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import skillkit
from paper_card import lines as paper_card_lines

from cpic_calls import (
    ACTIVITY_GENES,
    HLA_GENES,
    NO_RESULT,
    user_values,
    DrugResult,
    GeneCall,
    all_drug_results,
    call_from_array,
    load_tables,
    parse_diplotype_lines,
)
from genotype_file import GenotypeFileError, read_genotype_file
from presets import (
    ARRAY_PANEL,
    BOUNDARY,
    CATEGORY_ZH,
    DOCTOR_LINE,
    DRUGS,
    GENE_ZH,
    NOT_FROM_ARRAY,
    PHENOTYPE_ZH,
    POPULATION_ZH,
    WARFARIN_SITES,
    WARFARIN_ZH,
)

TITLE = "用药基因对照（CPIC）"
STRENGTH_ZH = {"Strong": "强", "Moderate": "中等", "Optional": "可选", "No Recommendation": "无", "n/a": "无"}
OUTPUT_GENES = ["CYP2C19", "CYP2C9", "CYP2D6", "SLCO1B1", "ABCG2", "TPMT", "NUDT15", "DPYD", "CYP3A5"]
FORM_SUFFIXES = (
    "肠溶胶囊", "缓释胶囊", "缓释片", "控释片", "肠溶片", "分散片", "咀嚼片", "注射液", "注射剂",
    "胶囊", "颗粒", "片剂", "片", "针",
)


def zh_phenotype(gene: str, phenotype: str, score: str = "") -> str:
    text = PHENOTYPE_ZH.get(phenotype, phenotype)
    if gene in ACTIVITY_GENES and score:
        text += f"（活性分 {score}）"
    return text


def drug_zh(drug: str) -> str:
    return DRUGS[drug][0]


# ---------------------------------------------------------------------------
# Medication names
# ---------------------------------------------------------------------------


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).casefold()
    text = re.sub(r"\d+(\.\d+)?\s*(mg|g|ug|μg|µg|ml|毫克|克|微克|毫升|片|粒|次)(/\w+)?", "", text)
    text = re.sub(r"[\s\-·()（）\[\]【】,，;；:：/]+", "", text)
    for suffix in FORM_SUFFIXES:
        if text.endswith(suffix) and len(text) > len(suffix) + 1:
            text = text[: -len(suffix)]
            break
    return text


def _name_index() -> List[Tuple[str, str]]:
    pairs = []
    for drug, (zh, aliases) in DRUGS.items():
        for name in [drug, zh, *aliases]:
            pairs.append((_fold(name), drug))
    return sorted(set(pairs), key=lambda item: -len(item[0]))


def match_drug(name: str) -> Optional[str]:
    """CPIC drug name for a medicine as a person writes it, or None."""
    folded = _fold(name)
    if not folded:
        return None
    index = _name_index()
    for alias, drug in index:
        if folded == alias:
            return drug
    for alias, drug in index:
        if len(alias) >= 2 and alias in folded and not alias.isascii():
            return drug
    return None


DOSE_TEXT = re.compile(r"\s*\d+(\.\d+)?\s*(mg|g|ug|μg|µg|ml|iu|毫克|克|微克|毫升|单位)(\s*/\s*\S+)?", re.IGNORECASE)


def display_name(name: str) -> str:
    """A medicine as the person wrote it, without any strength or dose."""
    return DOSE_TEXT.sub("", name).strip() or name.strip()


def load_lines(path: Optional[Path]) -> List[str]:
    if path is None:
        return []
    return [line.strip() for line in path.read_text(encoding="utf-8", errors="replace").splitlines() if line.strip() and not line.strip().startswith("#")]


# ---------------------------------------------------------------------------
# Calls
# ---------------------------------------------------------------------------


def collect(genotype: Optional[Path], diplotypes: Optional[Path]) -> Tuple[Dict[str, GeneCall], Dict[str, GeneCall], List[skillkit.Problem], Dict[str, str]]:
    """(calls used for lookup, array calls, problems, file facts)."""
    tables = load_tables()
    problems: List[skillkit.Problem] = []
    array_calls: Dict[str, GeneCall] = {}
    facts: Dict[str, str] = {}
    if genotype is None and diplotypes is None:
        problems.append(skillkit.Problem("genotype", "基因型文件", "missing", "缺少基因检测的原始数据文件，或者医院药物基因检测报告上的结果，至少要有一样。"))
        return {}, {}, problems, facts
    if genotype is not None:
        try:
            parsed = read_genotype_file(genotype)
        except GenotypeFileError as error:
            problems.append(skillkit.Problem("genotype", "基因型文件", "parse", error.message_zh))
            parsed = None
        if parsed is not None:
            facts = {"format": parsed.format, "rows": str(parsed.rows), "build": parsed.build_note}
            panel_ids = [site["rsid"] for gene in ARRAY_PANEL for site in tables["genes"][gene]["sites"]]
            seen = [rsid for rsid in panel_ids if rsid in parsed.calls or rsid in parsed.no_calls or rsid in parsed.odd]
            if not seen:
                problems.append(skillkit.Problem(
                    "genotype", "基因型文件", "coverage",
                    f"文件里读到 {parsed.rows} 行基因型，但本技能看的 {len(panel_ids)} 个药物基因位点一个也没有。"
                    "请确认交的是基因检测公司的完整「原始数据」下载，而不是报告或别的表格。",
                ))
            else:
                for gene, panel in ARRAY_PANEL.items():
                    array_calls[gene] = call_from_array(tables, gene, parsed, panel["reference_label"])
                facts["warfarin"] = "；".join(
                    f"{gene} {rsid} {parsed.genotype(rsid) or '没测到'}" for gene, rsid in WARFARIN_SITES.items()
                )
    clinical: Dict[str, GeneCall] = {}
    if diplotypes is not None:
        if not diplotypes.exists():
            problems.append(skillkit.Problem("diplotypes", "临床检测结果", "missing", f"找不到文件 {diplotypes.name}。"))
        else:
            clinical, messages = parse_diplotype_lines(tables, diplotypes.read_text(encoding="utf-8", errors="replace"))
            for message in messages:
                problems.append(skillkit.Problem("diplotypes", "临床检测结果", "parse", message))
    calls = {gene: call for gene, call in array_calls.items() if call.lookup_values}
    for gene, call in clinical.items():
        previous = array_calls.get(gene)
        if previous is not None and previous.lookup_values and set(previous.lookup_values) != set(call.lookup_values):
            call.notes.append("和芯片推断的结果不一样；这里按临床检测结果对照。")
        calls[gene] = call
    return calls, array_calls, problems, facts


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


def gene_line(call: GeneCall) -> str:
    if call.gene in HLA_GENES:
        return "、".join(PHENOTYPE_ZH.get(value, value) for value in call.lookup_values)
    if len(set(call.lookup_values)) == 1:
        return zh_phenotype(call.gene, call.phenotypes[0], call.activity_scores[0] if call.activity_scores else "")
    options = [zh_phenotype(call.gene, phenotype, score) for phenotype, score in zip(call.phenotypes, call.activity_scores)]
    return "判定不了，可能是" + "，也可能是".join(options)


def gene_table(array_calls: Dict[str, GeneCall], calls: Dict[str, GeneCall]) -> List[str]:
    lines = ["## 基因结果", "", "| 基因 | 芯片上看到的位点和基因型 | 推断的型别 | 代谢类型（CPIC 用语） |", "| --- | --- | --- | --- |"]
    genes = list(ARRAY_PANEL) + [gene for gene in calls if gene not in ARRAY_PANEL]
    for gene in genes:
        call = calls.get(gene) or array_calls.get(gene)
        label = GENE_ZH.get(gene, gene)
        if call is None:
            lines.append(f"| {label} | 没有交芯片数据 | — | — |")
            continue
        if call.source == "clinical":
            lines.append(f"| {label} | 临床检测结果 | {'；'.join(call.diplotypes)} | {gene_line(call)} |")
            continue
        sites = "、".join(f"{rsid} {genotype}" for rsid, genotype in call.tested) or "—"
        if call.source == "not_tested":
            lines.append(f"| {label} | 这些位点文件里都没有 | — | 没有结果 |")
        elif call.source == "unreadable":
            lines.append(f"| {label} | {sites or '—'} | 读不出 | 没有结果 |")
        else:
            lines.append(f"| {label} | {sites} | {' 或 '.join(call.diplotypes)} | {gene_line(call)} |")
    notes = []
    for gene in genes:
        call = calls.get(gene) or array_calls.get(gene)
        if call is None:
            continue
        for rsid, genotype, reason in call.unusable:
            notes.append(f"- {gene} {rsid} 读到 {genotype}：{reason}，这个位点没有用。")
        if call.source == "array":
            for allele, sites in call.not_assessed:
                notes.append(f"- {gene}：文件里没有 {'、'.join(sites)}，看不到 {allele}。")
        for note in call.notes:
            notes.append(f"- {gene}：{note}")
    if notes:
        lines += ["", *notes]
    lines += [
        "",
        "「*1」表示芯片看的那几个位点上没有发现变异，不等于这个基因完全没有变异；"
        "芯片没测的少见变异看不到。「判定不了」通常是因为芯片分不清两个变异在不在同一条染色体上。",
    ]
    return lines


def branch_lines(result: DrugResult, calls: Dict[str, GeneCall]) -> List[str]:
    out = []
    for branch in result.branches:
        where = POPULATION_ZH.get(branch.population, branch.population)
        prefix = f"{where}：" if where else ""
        categories = branch.categories
        strengths = sorted({STRENGTH_ZH.get(row["classification"], row["classification"]) for row in branch.rows})
        if len(categories) == 1:
            text = CATEGORY_ZH[categories[0]]
            if categories[0] != "none":
                text += f"（推荐强度：{'、'.join(strengths)}）"
        else:
            text = "取决于芯片分不开的型别：" + "；或".join(CATEGORY_ZH[item] for item in categories)
        out.append(f"  - {prefix}{text}")
    return out


def genes_used(result: DrugResult, calls: Dict[str, GeneCall], entry) -> str:
    parts = []
    for gene in result.genes:
        call = calls.get(gene)
        values = user_values(calls, gene, entry)
        if call is None or NO_RESULT in values:
            parts.append(f"{gene} 没有结果")
        elif gene in HLA_GENES:
            parts.append("、".join(PHENOTYPE_ZH.get(value, value) for value in sorted(values)))
        else:
            parts.append(f"{gene} {gene_line(call)}")
    return "；".join(parts)


def drug_block(result: DrugResult, calls: Dict[str, GeneCall], tables, facts: Optional[Dict[str, str]] = None) -> List[str]:
    entry = tables["drugs"][result.drug]
    head = f"- **{drug_zh(result.drug)}**（{result.drug}）"
    if result.status == "flowchart":
        cyp2c9 = calls.get("CYP2C9")
        used = [f"CYP2C9 {gene_line(cyp2c9)}" if cyp2c9 is not None and cyp2c9.lookup_values else "CYP2C9 没有结果"]
        if facts and facts.get("warfarin"):
            used.append(facts["warfarin"])
        return [f"{head}：{WARFARIN_ZH}", f"  - 医生要用的基因：{'；'.join(used)}", f"  - {DOCTOR_LINE}", f"  - 指南：{entry['guideline_url']}（doi:{entry['guideline_doi']}）"]
    if result.status == "needs_test":
        return [f"{head}：需要 {'、'.join(result.needs)} 的结果才能对照 CPIC。", f"  - 指南：{entry['guideline_url']}"]
    lines = [f"{head}：按 {genes_used(result, calls, entry)}"]
    lines += branch_lines(result, calls)
    if len(result.branches) > 1:
        lines.append("  - 适用哪一条要看你因为什么用这个药，由医生判断。")
    if set(result.categories) & {"avoid", "caution"} or any(len(branch.categories) > 1 for branch in result.branches):
        lines.append(f"  - {DOCTOR_LINE}")
    if result.no_result_genes:
        lines.append(f"  - {'、'.join(result.no_result_genes)} 没有结果，按 CPIC 表里「没有结果」的那一栏对照。")
    lines.append(f"  - 指南：{entry['guideline_url']}（doi:{entry['guideline_doi']}）")
    return lines


def classify(result: DrugResult) -> str:
    if result.status == "flowchart":
        return "discuss"
    if result.status == "needs_test":
        return "needs_test"
    categories = set(result.categories)
    if categories & {"avoid", "caution"}:
        return "discuss"
    if categories == {"standard"}:
        return "standard"
    if "standard" in categories:
        return "standard"
    return "none"


def medication_section(medications: List[str], results: Dict[str, DrugResult], calls, tables, facts) -> List[str]:
    lines = ["## 你正在用的药", ""]
    if not medications:
        lines.append("没有提供现用药。")
        return lines
    for name in medications:
        drug = match_drug(name)
        if drug is None:
            lines.append(f"- {display_name(name)}：CPIC 这几份指南里没有这个名字。不能据此停，也不能据此认为和基因无关。")
            continue
        lines.append(f"- {display_name(name)} → " + drug_block(results[drug], calls, tables, facts)[0].lstrip("- "))
        lines += drug_block(results[drug], calls, tables, facts)[1:]
    return lines


def render(calls, array_calls, facts, medications: List[str], asked: List[str], tables) -> str:
    results = {result.drug: result for result in all_drug_results(tables, calls)}
    groups: Dict[str, List[str]] = {"discuss": [], "standard": [], "none": [], "needs_test": []}
    for drug, result in results.items():
        groups[classify(result)].append(drug)
    lines = [f"# {TITLE}", ""]
    source = []
    if facts.get("format"):
        source.append(f"读了 {facts['rows']} 行原始数据（格式：{ {'23andme': '23andMe 式', 'wegene': 'WeGene', 'ancestrydna': 'AncestryDNA'}.get(facts['format'], facts['format']) }）")
    if any(call.source == "clinical" for call in calls.values()):
        source.append("用了你交的临床检测结果")
    lines.append("，".join(source) + "。" if source else "没有可用的基因型。")
    lines.append(
        f"按 CPIC 指南，有 {len(groups['discuss'])} 个药需要先和医生或药师核对，"
        f"{len(groups['standard'])} 个药 CPIC 认为可以按常规用法，"
        f"{len(groups['needs_test'])} 个药要别的检测结果才能对照。"
        "这不是说你需要或不需要这些药。"
    )
    if asked:
        lines += ["", "## 你问的药", ""]
        for name in asked:
            drug = match_drug(name)
            if drug is None:
                lines.append(f"- {display_name(name)}：CPIC 这几份指南里没有这个名字。这不代表它和基因无关，也不是停药或放心用的理由。")
            else:
                lines += drug_block(results[drug], calls, tables, facts)
    lines += ["", *medication_section(medications, results, calls, tables, facts)]
    lines += ["", *gene_table(array_calls, calls)]
    if facts.get("warfarin"):
        lines += ["", f"华法林相关位点（只供医生算剂量时参考）：{facts['warfarin']}。"]
    lines += ["", "## 需要先和医生或药师核对的药", ""]
    if groups["discuss"]:
        lines.append("下面这些药，按你的基因结果 CPIC 建议换药、避免、调整用法或加强监测。" + DOCTOR_LINE + "正在用的药不要自己停。")
        for drug in groups["discuss"]:
            lines += drug_block(results[drug], calls, tables, facts)
    else:
        lines.append("没有。")
    lines += ["", "## CPIC 认为可以按常规用法的药", ""]
    shown = []
    for drug in groups["standard"]:
        missing = results[drug].no_result_genes
        shown.append(drug_zh(drug) + (f"（只按 {'、'.join(g for g in results[drug].genes if g not in missing)}；{'、'.join(missing)} 没有结果）" if missing else ""))
    lines.append("、".join(shown) + "。" if shown else "没有。")
    lines.append("「按常规用法」只是说基因不是调整的理由，用不用、用多少仍由医生按病情定。")
    if groups["none"]:
        lines += ["", "## CPIC 对你的结果没有给出推荐的药", "", "、".join(drug_zh(drug) for drug in groups["none"]) + "。"]
    lines += ["", "## 要别的检测结果才能对照的药", ""]
    needs: Dict[str, List[str]] = {}
    for drug in groups["needs_test"]:
        needs.setdefault("、".join(results[drug].needs), []).append(drug_zh(drug))
    for genes, names in needs.items():
        lines.append(f"- 需要 {genes}：{'、'.join(names)}。")
    if not needs:
        lines.append("没有。")
    lines += ["", "## 芯片数据判断不了的", ""]
    for gene, text in NOT_FROM_ARRAY.items():
        lines.append(f"- **{gene}**：{text}")
    source_meta = tables["source"]
    lines += [
        "",
        "## 数据来源",
        "",
        f"等位基因功能、表型规则和用药推荐都来自 CPIC 数据库（{source_meta['api']}，{source_meta['accessed']} 读取，CC0 公开）。"
        "CPIC 会更新指南，临床使用前请医生或药师查当前版本。",
        "",
        f"边界: {BOUNDARY}",
    ]
    return "\n".join(lines) + "\n"


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


def outputs(calls: Dict[str, GeneCall], tables) -> Dict[str, Optional[str]]:
    values: Dict[str, Optional[str]] = {}
    for gene in OUTPUT_GENES:
        call = calls.get(gene)
        key = gene.lower() + "_phenotype"
        if call is None or not call.lookup_values:
            values[key] = None
        elif len(set(call.lookup_values)) == 1:
            score = call.activity_scores[0] if call.activity_scores else ""
            values[key] = call.phenotypes[0] + (f" (activity score {score})" if gene in ACTIVITY_GENES and score else "")
        else:
            values[key] = "Indeterminate: " + " | ".join(call.phenotypes)
    results = all_drug_results(tables, calls)
    discuss = [result.drug for result in results if classify(result) == "discuss"]
    values["drugs_to_discuss"] = ", ".join(discuss) if discuss else ""
    return values


def write_report(out_dir: Path, genotype: Optional[Path], diplotypes: Optional[Path] = None,
                 medications: Optional[Path] = None, drugs: Optional[List[str]] = None) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stale = out_dir / "problems.json"
    if stale.exists():
        stale.unlink()
    manifest = skillkit.load_manifest(__file__)
    tables = load_tables()
    calls, array_calls, problems, facts = collect(genotype, diplotypes)
    if problems:
        path = skillkit.write_problems(out_dir, problems, TITLE, BOUNDARY)
        path.write_text(_with_paper_card(path.read_text(encoding="utf-8")), encoding="utf-8")
        skillkit.write_result(out_dir, manifest, {spec["key"]: None for spec in manifest["outputs"]})
        return path
    text = render(calls, array_calls, facts, load_lines(medications), drugs or [], tables)
    path = out_dir / "report.md"
    path.write_text(_with_paper_card(text), encoding="utf-8")
    skillkit.write_result(out_dir, manifest, outputs(calls, tables))
    return path


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="CPIC drug-gene lookup from a consumer genotype file")
    parser.add_argument("--genotype", type=Path, help="23andMe-style raw data file (.txt, .zip, .gz)")
    parser.add_argument("--diplotypes", type=Path, help="clinical results, one gene per line, e.g. 'CYP2D6 *1/*10'")
    parser.add_argument("--drug", action="append", default=[], help="a medicine name to look up first (repeatable)")
    parser.add_argument("--medications", type=Path, help="current medicines, one per line")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    path = write_report(args.out, args.genotype, args.diplotypes, args.medications, args.drug)
    sys.stdout.write(str(path) + "\n")
    if (args.out / "problems.json").exists():
        return skillkit.EXIT_INPUT_PROBLEM
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
