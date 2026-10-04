---
name: steeramed-core
description: >-
  Writes a personal methylation report. It downloads the GEO reference cohort,
  STRING, and STITCH by itself, then scores one person's 450k, EPIC, or EPICv2
  methylation against that reference, including current medicines and checkup
  labs. Use when the user mentions SteeraMed, their methylation data, a
  personal health report, checkup labs plus methylation, or which compounds
  align with their blood methylation. Do not use for SteeraMed-bench, Guney
  network proximity, or the 332-module atlas.
---

# SteeraMed Core

Produce one personal report. The user supplies methylation and, when they have them, age, sex, current medicines, and a checkup file. The skill downloads GEO, STRING, and STITCH. Never ask the user for those reference files. Never run `run_pipeline.py` or `build_modules.py` for this report.

The report is an alignment list. It does not say which medicine to start or stop. Copy `out/report.md`, including its `边界:` line.

## Command

Set `SKILL` to the directory that contains this file.

```bash
uv run --with 'numpy>=1.21' --with 'scipy>=1.7' python "$SKILL/scripts/personal_report.py" \
  --preset aging \
  --beta METHYLATION.csv \
  --age AGE \
  --sex SEX \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --out out/
```

Pick the preset from what the user said. Default `aging`. Use `ra`, `breast_cancer`, or `depression` only when they name that condition. Do not ask them to choose a preset if aging fits.

`--sex` accepts `M`, `F`, `male`, `female`, `男`, and `女`. Aging compares the person with adults younger than 50 in GSE40279. The other presets need age and sex so controls can be matched.

Methylation is one sample in CSV or TSV. Columns may be gene symbols or `cg` probe ids. Probe ids from HM450, EPIC, and EPICv2 are mapped to promoters by the script. A directory of IDAT files cannot be read; ask for a beta table instead.

`--medications` is optional, one name per line. `--labs` is optional: a table (`项目,结果,单位`) or plain text containing 谷丙转氨酶, 谷草转氨酶, 肌酐, 肾小球滤过率, 血红蛋白, or 血小板. Abnormal labs are shown and do not delete compounds.

The first run caches references under `~/.cache/steeramed-core/` and can download about 1–4 GB. Wait for the script. Do not draft the report while it downloads. Later runs reuse the cache. Pass `--rebuild` only if the user asks to refresh the reference.

## Report

`out/report.md` is the whole user-facing product:

- which gene modules differ from the reference
- compound names, not raw STITCH ids, that overlap those modules
- whether current medicines appear on that list
- checkup values that sit outside common adult bounds

Do not add Recall-K, SA scores, or advice to start or stop a medicine.

## Method, kept inside the script

1. Download the preset GEO series matrix, STRING v12, STITCH v5 links, STITCH chemical sources, and the 450k promoter manifest.
2. Average CpGs with GENCODE TSS distance from -1500 to 0.
3. Freeze the top 100 STRING modules and top 200 compound features on the cohort.
4. Keep chemicals with an ATC source, a readable alias when one exists, and the preset target-count window.
5. Score only the user's delta on the frozen features.

Cohort group counts the parser is built to recover: RA 354/335, breast cancer ICD C50 235 and 424 people with no cancer code, depression diagnosis case versus control, aging age < 50 versus age > 55.

Further method notes: [references/pipeline.md](references/pipeline.md), [references/presets.md](references/presets.md), [references/claims.md](references/claims.md). An example command is in [examples.md](examples.md).
