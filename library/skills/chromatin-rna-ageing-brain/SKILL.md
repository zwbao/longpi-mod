---
name: chromatin-rna-ageing-brain
description: >-
  Scores one donor's nuclei with the LCS-erosion score from Wen et al., Nature 2024 (DOI 10.1038/s41586-024-07239-w) when genomic-distance bins are supplied, and otherwise orders short-range contact counts. Use when the user brings MUSIC nucleus counts from ageing human frontal cortex and asks about multiplex chromatin and RNA interactions. The score is the midpoint of the bin selected from the ten most frequent distance bins, and a nucleus is called eroded only above the printed cutoff. The skill does not compute the SCALE transcriptomic age.
---

# 染色质互作

用户交每个核的短程互作计数、现用药和体检。不要向用户要 GEO、STRING 或 PDF。

有距离箱时，报告计算局部染色质结构侵蚀分数，并与正文的分界比较。只有短程计数时，按计数从少到多排列，不算该分数。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --measurements MEASUREMENTS.csv \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

`MEASUREMENTS.csv` needs `nucleus_id`. Provide either `bin_start`, `bin_end`, and `frequency`, or `short_range_contacts`. Optional columns are `sex`, `xist_x_contacts`, and `rna_reads`.

`--medications` is optional, one name per line. `--labs` is optional. Abnormal checkup rows are printed and do not add or remove names from the method list. A medicine that is not on that list keeps the sentence 不能据此停.

## Report

Copy `out/report.md`, including its final `边界:` line. With distance bins, the report gives the LCS-erosion score and whether it exceeds the printed cutoff. With only short-range counts, it orders those counts. For female nuclei above the RNA-read filter, it may show the supplied XIST–X count. It may not call a nucleus old or diseased.

Method notes: [references/contract.md](references/contract.md), [references/claims.md](references/claims.md). The command is also in [examples.md](examples.md).
