# Examples

The product command is `personal_report.py`. The DrugAge table is already in the skill. Do not ask the user for that file.

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --age 50 \
  --out out
```

`meds.txt` is one medicine name per line. 阿司匹林肠溶片 matches 阿司匹林. A name that is not on the list is not a reason to stop the medicine.

`checkup.csv` columns can be `项目,结果,单位`. Values outside common adult bounds are printed as context and do not change the compound list.

Quote `out/report.md`, including the `边界:` line. The vector-field order is the model's sequence, not an instruction to start an intervention.
