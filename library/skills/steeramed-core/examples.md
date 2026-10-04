# Examples

The product command is `personal_report.py`. It downloads the reference cohort, STRING, and STITCH itself. Do not ask the user for those files, and do not run `run_pipeline.py` or `build_modules.py` for a personal report.

```bash
uv run --with 'numpy>=1.21' --with 'scipy>=1.7' python "$SKILL/scripts/personal_report.py" \
  --preset aging \
  --beta me.csv \
  --age 60 \
  --sex 男 \
  --medications meds.txt \
  --labs checkup.csv \
  --out out
```

`me.csv` is one person. Columns are gene symbols or `cg` probe ids from 450k, EPIC, or EPICv2. The script downloads the matching probe map.

`meds.txt` is one medicine name per line. Chinese names such as 阿司匹林 and 烟酸 are matched to STITCH aliases. A missing name is not a reason to stop the medicine.

`checkup.csv` columns can be `项目,结果,单位`. Recognized items include 谷丙转氨酶, 谷草转氨酶, 肌酐, 肾小球滤过率, 血红蛋白, and 血小板. Values outside common adult bounds are printed as context and do not change the compound list.

Quote `out/report.md`. The compound names in that file are STITCH aliases, not raw `CIDm` identifiers when an alias exists.
