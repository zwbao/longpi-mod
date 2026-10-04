---
name: longevitybench
description: >-
  Writes a personal readout of the Longevity Claw DrugAge ranking and its
  eight-intervention hallmark vector field. It uses the frozen DrugAge table
  from that repository, scores compounds with the repository formula, and
  lists the control-law order for an age. Use when the user mentions
  LongevityBench, Longevity Claw, DrugAge, compound ranking, control-theory
  interventions, or which intervention the model orders. Current medicines
  and checkup labs are context. The report does not say what to start or stop.
---

# LongevityBench readout

Produce one personal report. The user may supply an age, current medicines, and a checkup file. The compound table is already in this skill. Never ask the user for DrugAge, GEO, STRING, NHANES, or model weights.

The report is a retrospective ranking plus a vector-field order. It does not say which intervention to start or stop. Copy `out/report.md`, including its `边界:` line. A missing name or a low rank is not a reason to stop a medicine. Checkup values do not add or remove compounds.

## Command

Set `SKILL` to the directory that contains this file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications MEDS.txt \
  --labs CHECKUP.csv \
  --age AGE \
  --out out/
```

`--age` defaults to 50, the age used by the repository's control-law entry point. `--medications` is optional, one name per line. `--labs` is optional: a table (`项目,结果,单位`) or plain text containing 谷丙转氨酶, 谷草转氨酶, 肌酐, 肾小球滤过率, 血红蛋白, or 血小板.

Chinese names such as 阿司匹林肠溶片, 二甲双胍, and 雷帕霉素 are matched to DrugAge display names. IDAT and PDF files are not read.

Do not run `prepare_reference.py` unless the user asks to refresh the DrugAge file. The frozen snapshot is `data/drugage.csv`. If a refresh is not run, do not say that it was.

## Report

`out/report.md` is the whole user-facing product:

- compounds with at least two published experiments, under readable names
- whether current medicines appear on that list, and whether they appear in the eight-intervention field
- the vector-field order for the given age
- checkup values outside common adult bounds

Do not add a sentence that tells the user to start or stop a medicine. The control cost is not a clinical age. NHANES elastic-net age, the 353-CpG ridge, and L-Qwen3.5-9B are not part of this command.

Method notes: [references/claims.md](references/claims.md), [references/operations.md](references/operations.md). An example command is in [examples.md](examples.md).
