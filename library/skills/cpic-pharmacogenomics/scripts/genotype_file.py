"""Read a consumer genotype raw file by rsID.

The same file is copied into cpic-pharmacogenomics and
nutrigenetic-variant-panel. The library shares code only through
tools/skillkit, so a skill-level helper is duplicated; keep the two copies
identical (each skill's tests check the other copy when it is present).

Formats read:

- 23andMe: tab-separated ``rsid chromosome position genotype``. Comment lines
  start with ``#``; the column header is itself a ``#`` line. Genotypes are on
  the plus strand of GRCh37; autosomes have two letters, X/Y/MT often one.
- WeGene (微基因): the same four tab-separated columns with about fifteen ``#``
  comment lines, build 37, plus strand, and two letters even for hemizygous
  calls, as described on https://www.wegene.com/question/1145 (a WeGene
  community answer; no official specification was found). Other Chinese
  consumer tests that export "23andMe 格式" are read the same way.
- AncestryDNA: ``rsid chromosome position allele1 allele2`` with a header line.
- The same columns separated by commas.
- ``.gz`` files, and ``.zip`` files that hold one text file.

Rows are matched by rsID only. Positions are not used, because consumer files
are on GRCh37 and CPIC positions are on GRCh38. No-calls (``--``, ``00``) are
kept apart from calls. Insertion/deletion calls (``D``, ``I``) are kept as
letters; callers decide whether they can use them.
"""

from __future__ import annotations

import gzip
import io
import re
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set

RSID = re.compile(r"^(rs|i)\d+$", re.IGNORECASE)
GENOTYPE = re.compile(r"^[ACGTDI]{1,2}$")
NO_CALL = {"--", "00", "0", "-", "NC", "N", "NN", "??"}


class GenotypeFileError(ValueError):
    """The file cannot be read as a genotype raw file. message_zh says why."""

    def __init__(self, message_zh: str):
        super().__init__(message_zh)
        self.message_zh = message_zh


@dataclass
class GenotypeFile:
    calls: Dict[str, str] = field(default_factory=dict)
    no_calls: Set[str] = field(default_factory=set)
    odd: Dict[str, str] = field(default_factory=dict)
    format: str = "unknown"
    rows: int = 0
    build_note: str = ""

    def genotype(self, rsid: str) -> Optional[str]:
        return self.calls.get(rsid.lower())


def _text(path: Path) -> str:
    data = Path(path).read_bytes()
    if data[:2] == b"\x1f\x8b":
        data = gzip.decompress(data)
    elif data[:4] == b"PK\x03\x04":
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            names = [name for name in archive.namelist() if not name.endswith("/") and not name.startswith("__MACOSX")]
            if len(names) != 1:
                raise GenotypeFileError("压缩包里应该只有一个原始数据文本文件，这个压缩包里有 %d 个。请先解压，交里面的 .txt 文件。" % len(names))
            data = archive.read(names[0])
    for encoding in ("utf-8-sig", "gb18030", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise GenotypeFileError("文件不是文本，读不出来。")


def read_genotype_file(path: Path) -> GenotypeFile:
    """Parse the file. Raises GenotypeFileError when nothing usable is in it."""
    path = Path(path)
    if not path.exists():
        raise GenotypeFileError(f"找不到基因型文件 {path.name}。")
    text = _text(path)
    out = GenotypeFile()
    comments: List[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#"):
            comments.append(line)
            continue
        parts = [item.strip().strip('"') for item in re.split(r"[\t,]|\s{2,}| ", line) if item.strip()]
        if not parts or not RSID.match(parts[0]):
            continue  # AncestryDNA header, stray text
        out.rows += 1
        rsid = parts[0].lower()
        if len(parts) >= 5 and len(parts[3]) == 1 and len(parts[4]) == 1:
            genotype = (parts[3] + parts[4]).upper()
            out.format = "ancestrydna"
        elif len(parts) >= 4:
            genotype = parts[3].upper()
            if out.format == "unknown":
                out.format = "23andme"
        else:
            continue
        if genotype in NO_CALL or set(genotype) <= {"0", "-"}:
            out.no_calls.add(rsid)
        elif GENOTYPE.match(genotype):
            out.calls[rsid] = genotype
        else:
            out.odd[rsid] = genotype
    head = " ".join(comments[:40]).casefold()
    if "wegene" in head:
        out.format = "wegene"
    if "build 37" in head or "grch37" in head or "hg19" in head:
        out.build_note = "GRCh37"
    elif "build 38" in head or "grch38" in head or "hg38" in head:
        out.build_note = "GRCh38"
    if out.rows == 0:
        raise GenotypeFileError(
            "这个文件里没有找到基因型行。需要的是基因检测公司导出的原始数据文本："
            "每行 rsID、染色体、位置、基因型，用制表符或逗号分开（23andMe、WeGene 等的「原始数据」下载）。"
        )
    return out


def called_alleles(genotype: str) -> List[str]:
    """Two alleles for a call. A single letter (hemizygous) is doubled."""
    if len(genotype) == 1:
        return [genotype, genotype]
    return [genotype[0], genotype[1]]
