---
name: pyaging
description: >-
  Runs published biological aging clocks on a user-supplied feature matrix
  with pyaging. Use when the user mentions pyaging, Horvath, Hannum,
  DunedinPACE, GrimAge, PhenoAge, AltumAge, or asks for a clock prediction
  from methylation, expression, chromatin, or blood-chemistry values. Clock
  outputs are model estimates, not a reason to start or stop a treatment.
---

# pyaging

Run [pyaging](https://github.com/lucascamillomd/pyaging) 0.5.2 (`edb1b37`, Camillo, Bioinformatics 2024, doi:10.1093/bioinformatics/btae200). Python 3.11 or newer. Do not copy the library into this repository. Clock weights download from the `pyaging` Hugging Face organization when a clock runs.

This skill predicts from a matrix the user already has. It does not build a literature catalog, and it does not replace the DrugAge ranking in `longevitybench`.

## Run

Rows are samples. Columns are the clock's features (CpG probes, genes, or chemistry analytes). pyaging matches features only against these columns and fills a missing one with the clock's reference value (or 0) without an error.

Some clocks take chronological age and sex as features named `age` and `female` (1 = female, 0 = male). At `edb1b37` these are, from each clock's notebook: `grimage`, `grimage2`, `pcgrimage`, `dnamfitage`, `kdmage` and `linage2` (both); `grimage2adm`, `grimage2b2m`, `grimage2cystatinc`, `grimage2gdf15`, `grimage2loga1c`, `grimage2packyrs`, `grimage2timp1`, `dnamfitagevo2max`, `cpgptgrimage3`, `cpgptpcgrimage3`, `phenoage` and `phenoagesaopaulo` (age); `dnamfitagegait`, `dnamfitagegrip` and `homeostaticdysregulation` (female). GrimAge's reference values are a 65-year-old woman, so leaving these columns out, or moving them to `metadata_cols`, scores every sample as one. Keep `age` and `female` as columns. Put only covariates that no clock reads in `metadata_cols`.

```bash
uv run --python 3.11 --with pyaging python - << 'PY'
import pandas as pd
import pyaging as pya

df = pd.read_csv("MATRIX.csv", index_col=0)
df["age"], df["female"] = AGE, FEMALE  # features, not metadata
adata = pya.pp.df_to_adata(df)
pya.pred.predict_age(adata, ["horvath2013", "grimage2"])
print(adata.obs.to_csv())
print({clock: adata.uns[f"{clock}_metadata"]["unit"] for clock in ["horvath2013", "grimage2"]})
PY
```

`predict_age` writes values onto `adata.obs` and returns `None`. Keep the names it prints. Each clock's unit is in `adata.uns[f"{clock}_metadata"]["unit"]`, a list such as `["years"]`, `["kilobases"]`, `["unitless"]` or `["beta value"]`; only `years` is an age. `adata.uns[f"{clock}_missing_features"]` lists the features pyaging filled. `pya.utils.show_all_clocks()` lists clocks; do not invent a name that is absent from that list or from the user's request.

DunedinPACE is a pace. The tAge clocks need raw RNA-seq counts, at least two samples, and are differences against the samples predicted together. Say which of those applies when reporting them.

## Command

For one person's matrix, use the script. It checks the matrix, runs the clocks you name, and writes `out/report.md` and `out/result.json`. It needs an interpreter with pyaging and pandas; the harness maps this skill's `runtime: pyaging` to that interpreter.

```bash
python "$SKILL/scripts/personal_report.py" \
  --matrix MATRIX.csv \
  --clocks horvath2013,grimage2,dunedinpace \
  --age AGE \
  --sex SEX \
  --out out/
```

`MATRIX.csv`: first column the sample name, other columns the clock's features. Methylation values are betas on the 0–1 scale; percentages and M-values are refused, not rescaled. At most 20 samples. `--metadata-cols` names covariate columns that are not features (default none). `--data-type other` skips the beta check for expression or chemistry matrices.

GrimAge and the other clocks listed under Run need `--age` and `--sex` (`male`/`female`, `m`/`f`, `男`/`女`). The script writes them into every sample as the `age` and `female` feature columns. A matrix may carry its own `age` (years, 0–120) and `female` (0 or 1) columns instead, one value per sample; blanks are refused because pyaging would impute them. When a flag and a column are both given they must agree for every sample. `age` and `female` are never moved to metadata, even when named in `--metadata-cols`. A requested clock that needs one of them and gets neither is refused before pyaging runs; a clock whose run still filled `age` or `female` from reference values is refused afterwards and its value is not reported.

Only clocks whose pyaging unit is `years` are printed in 岁 with the difference from chronological age (the sample's `age` column, else `--age`). DNAmTL (kilobases), DunedinPACE and DunedinPoAm38 (pace), Zhang mortality (unitless), epiTOC1 and the single-CpG clocks (β value), McCartney scores, deconvolution proportions, and a clock with no recorded unit are printed with their unit and no difference.

Exit code 3 means the inputs did not pass the checks; 4 means pyaging is not installed in this interpreter. Neither case is replaced with an estimated age. `result.json` names each clock output `dnam_` plus the pyaging clock name without its own leading `dnam`: `dnam_grimage`, `dnam_grimage2`, `dnam_horvath2013`, `dnam_tl` (from `dnamtl`), `dnam_phenoage` (from `dnamphenoage`). A methylation PhenoAge is not the blood-chemistry phenotypic age of `accelerated-biological-aging-risk`. pyaging's own `phenoage` is the blood-chemistry clock; it appears in the report and never in `dnam_phenoage`. A clock without a declared output appears only in the report.

## Which skill

Prefer the `epiage` skill for blood β files and for the McCartney trait scores, `cvdwesterman` and `depressionbarbu`. In pyaging `edb1b37`, six McCartney models (`mccartneybmi`, `mccartneybodyfat`, `mccartneyeducation`, `mccartneyhdlcholesterol`, `mccartneyldlcholesterol`, `mccartneytotalcholesterol`) apply a sigmoid to the paper's linear score, so they return a bounded unitless number rather than the score. `cvdwesterman` applies a sigmoid over 235 CpGs and `depressionbarbu` adds an intercept of 12.2169841 to 196 CpGs; the epiage skill's source audit found these coefficient sets incomplete or unsupported. Keep pyaging for non-blood tissues, AltumAge, the PC clocks, and transcriptomic, histone, chromatin and other non-methylation clocks.

## Boundary

Report the clock name, the value column, the sample count, and any warning pyaging printed about missing features or imputation. Do not replace a failed clock with an estimated age. Do not tell the user to start or stop a medicine because a clock moved.
