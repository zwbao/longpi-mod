"""Published numbers and the personal list. No regression weights are stored here."""

from __future__ import annotations

import csv
from pathlib import Path

BOUNDARY = (
    "边界: 这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)


FULL_TEXT = True
FRONTAL_CORTEX_SAMPLES = 14
NUCLEI_RESOLVED = 9087
LCS_TOP_BINS = 10
LCS_ERODED_ABOVE = 3 * 10**5
RNA_READS_FOR_XIST = 5000


def _float(text: str):
    if text == "":
        return None
    return float(text)


def _xist_clause(row):
    sex = (row.get("sex") or "").casefold()
    xist = row.get("xist_x_contacts") or ""
    if sex not in {"f", "female", "女"} or xist == "":
        return ""
    rna = _float(row.get("rna_reads") or "")
    if rna is not None and rna <= RNA_READS_FOR_XIST:
        return " 核糖核酸读数没有超过正文讨论 XIST 异质性时保留的读数门槛，这里不写 XIST 计数。"
    return f" 女性皮层细胞的 XIST 与 X 染色体互作计数是 {xist}。正文只描述异质性。"


def _lcs_score(bins):
    usable = []
    for start, end, freq in bins:
        width_mb = (end - start) / 1_000_000
        if width_mb <= 0:
            continue
        usable.append((start, end, freq / width_mb))
    if len(usable) < LCS_TOP_BINS:
        return None
    usable.sort(key=lambda item: item[0])
    total = sum(item[2] for item in usable)
    if total <= 0:
        return None
    ranked = sorted(range(len(usable)), key=lambda index: (-usable[index][2], index))
    top = [index + 1 for index in ranked[:LCS_TOP_BINS]]
    chosen = int(round(sum(top) / len(top)))
    if chosen < 1 or chosen > len(usable):
        return None
    start, end, _ = usable[chosen - 1]
    return (start + end) / 2


def _fmt(number):
    if number == int(number):
        return str(int(number))
    return f"{number:.6g}"


def _bin_rows(rows):
    grouped = {}
    order = []
    meta = {}
    for index, row in enumerate(rows):
        if (row.get("bin_start") or "") == "":
            continue
        nucleus = row.get("nucleus_id") or row.get("nucleus") or ""
        start = _float(row.get("bin_start") or "")
        end = _float(row.get("bin_end") or "")
        freq = _float(row.get("frequency") or "")
        if nucleus == "" or start is None or end is None or freq is None:
            continue
        if nucleus not in grouped:
            grouped[nucleus] = []
            order.append((index, nucleus))
            meta[nucleus] = row
        grouped[nucleus].append((start, end, freq))
    return order, grouped, meta


def _short_range_items(rows):
    nuclei = []
    for index, row in enumerate(rows):
        nucleus = row.get("nucleus_id") or row.get("nucleus") or ""
        contacts = _float(row.get("short_range_contacts") or "")
        if nucleus == "" or contacts is None:
            continue
        nuclei.append((contacts, index, row))
    nuclei.sort(key=lambda item: (item[0], item[1]))
    items = []
    for contacts, _, row in nuclei:
        nucleus = row.get("nucleus_id") or row.get("nucleus")
        detail = f"短程互作计数是 {contacts:g}。这不是 LCS-erosion 分数，正文的分界用在距离箱上。"
        detail += _xist_clause(row)
        items.append({"name": nucleus, "aliases": [nucleus], "detail": detail})
    if items:
        sentence = "这次按短程互作计数从少到多排列你提供的核，没有距离箱，所以没有计算 LCS-erosion 分数。"
    else:
        sentence = "没有提供短程互作计数或距离箱，这次没有排列。"
    return sentence, items


def render_body(rows):
    order, grouped, meta = _bin_rows(rows)
    if not grouped:
        sentence, items = _short_range_items(rows)
        return ["# 染色质互作", "", sentence], items
    scored = []
    for index, nucleus in order:
        score = _lcs_score(grouped[nucleus])
        scored.append((score is None, score if score is not None else 0, index, nucleus))
    scored.sort()
    items = []
    for missing, score, _, nucleus in scored:
        if missing:
            detail = "距离箱少于十个，不算 LCS-erosion 分数。"
        else:
            if score > LCS_ERODED_ABOVE:
                band = "超过正文的分界。正文把超过分界的核称为局部染色质结构侵蚀。"
            else:
                band = "没有超过正文的分界。"
            detail = (
                f"LCS-erosion 分数是 {_fmt(score)}，是频率经箱宽归一后最高的十个箱的平均序号四舍五入后那个箱的中点。"
                f"{band}这里不把这个核称为年老或患病。"
            )
        detail += _xist_clause(meta[nucleus])
        items.append({"name": nucleus, "aliases": [nucleus], "detail": detail})
    return ["# 染色质互作", "", "这次按正文的算法算了局部染色质结构侵蚀分数。"], items


def fixture_rows():
    return [
        {"nucleus_id": "n2", "short_range_contacts": "30", "sex": "女", "xist_x_contacts": "4"},
        {"nucleus_id": "n1", "short_range_contacts": "10", "sex": "男", "xist_x_contacts": "1"},
    ]


def write_fixture(path: Path) -> None:
    path.write_text(
        "nucleus_id,short_range_contacts,sex,xist_x_contacts\nn2,30,女,4\nn1,10,男,1\n",
        encoding="utf-8",
    )


def check_published_numbers():
    assert FRONTAL_CORTEX_SAMPLES == 14
    assert NUCLEI_RESOLVED == 9087
    assert LCS_TOP_BINS == 10
    assert LCS_ERODED_ABOVE == 300000
    assert RNA_READS_FOR_XIST == 5000
    names = [item["name"] for item in render_body(fixture_rows())[1]]
    assert names == ["n1", "n2"]
    details = [item["detail"] for item in render_body(fixture_rows())[1]]
    assert "XIST" not in details[0]
    assert "XIST" in details[1]
    preserved = []
    eroded = []
    for index in range(1, 13):
        start = (index - 1) * 10000
        preserved.append(
            {
                "nucleus_id": "kept",
                "bin_start": str(start),
                "bin_end": str(start + 10000),
                "frequency": "10" if index <= 10 else "1",
            }
        )
        start = (index - 1) * 200000
        eroded.append(
            {
                "nucleus_id": "eroded",
                "bin_start": str(start),
                "bin_end": str(start + 200000),
                "frequency": "10" if index <= 10 else "1",
            }
        )
    scored = {item["name"]: item["detail"] for item in render_body(preserved + eroded)[1]}
    assert "LCS-erosion 分数是 55000" in scored["kept"]
    assert "没有超过正文的分界" in scored["kept"]
    assert "LCS-erosion 分数是 1100000" in scored["eroded"]
    assert "超过正文的分界" in scored["eroded"]
