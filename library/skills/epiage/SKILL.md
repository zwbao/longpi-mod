---
name: epiage
description: >-
  Computes 25 DNA-methylation aging clocks and markers (GrimAge V1/V2, Horvath,
  Hannum, PhenoAge, DunedinPACE, DNAmTL, stochastic and Ying clocks) and 12
  exposome and health scores (McCartney smoking, alcohol, BMI, cholesterol,
  education) from one human whole-blood β-value file, offline, with
  gangchen/epiage-skill. Use when the user has a blood methylation export
  (WeGene, EPIC, 450K, MSA, or SeSAMe betas.csv), mentions IDAT, 甲基化年龄,
  表观遗传时钟, GrimAge, DunedinPACE or DNAmTL, or asks for their epigenetic age.
  Prefer pyaging for non-blood tissue, AltumAge, PC clocks, or transcriptomic
  clocks. Clock outputs are model estimates, not a reason to start or stop a
  treatment.
---

# epiage

Run `compute_clocks.py` from [gangchen/epiage-skill](https://github.com/gangchen/epiage-skill) at `fcf4e3b` (MIT, © 2026 gangchen). `scripts/compute_clocks.py`, `data/`, `references/model-audit.md`, `LICENSE-epiage` and `NOTICE-epiage` are unmodified copies. The IDAT preprocessing part of upstream (R, SeSAMe and a 47 MiB reference cache) is not included here.

It needs only pandas and numpy. Coefficients, the DunedinPACE reference and a whole-blood methyLImp imputation panel are in `data/`; nothing is downloaded. It is an open-source reimplementation that follows biolearn and the original papers, not the official Horvath DNAm Age calculator or a Clock Foundation result. Upstream corrected the DNAmTL intercept sign, removed unsupported McCartney sigmoids, and returns `cvd` and `depression` as unavailable; `references/model-audit.md` records why.

`python3 scripts/compute_clocks.py --list-clocks` prints every model key, unit and group.

## Command

Set `SKILL` to the directory that contains this file. The harness maps `runtime: scientific` to an interpreter with `scripts/requirements.txt`.

```bash
python "$SKILL/scripts/personal_report.py" \
  --betas BETAS.csv \
  --clocks core \
  --age AGE --sex SEX \
  --out out/
```

`--clocks` takes model keys or groups, comma- or space-separated: `all`, `aging` (25 clocks and markers), `grimage`, `core` (default: GrimAge V1/V2, Horvath, Hannum, PhenoAge), `firstgen`, `secondgen`, `thirdgen`, `exposome`, `health`, `phenotypes`. `--sex` accepts m, f, male, female, 男, 女. `--sensitivity 40,45,50` reruns GrimAgeV2 at other ages for the first sample, for when only an age range is known.

GrimAge feeds age and sex into its formula. Any selection that contains `grimagev1` or `grimagev2`, including the default `core`, needs both `--age` and `--sex`; without them the script refuses (exit 3) rather than dropping GrimAge. Without them, pick other models, for example `--clocks horvath,hannum,phenoage`. `--age` also adds "reading minus age" for models whose unit is years.

## Input

- CSV or TSV, optionally gzip. Long: two columns, CpG id and β. Matrix: first column CpG id, then one column per sample.
- β values from 0 to 1, missing as `NA` or blank. Percentages and M-values are refused, not rescaled.
- Duplicate CpG ids, probe suffixes such as `cg..._BC11`, and files without `cg` ids are refused; collapse replicates in SeSAMe first.
- Human whole blood only. `--age` and `--sex` apply to every sample column, so run each person separately. At most 20 samples.

Missing clock CpGs are imputed from the bundled whole-blood panel. The report shows coverage, imputed CpGs and low-confidence fills (reference SD > 0.08) for each model; it marks coverage below 90%.

## Outputs and exit codes

`out/report.md` (Chinese) and `out/result.json`. `result.json` holds the first sample's value for every model as `dnam_<key>` (for example `dnam_grimagev2`, `dnam_dnamtl`, `dnam_smoking`), `null` when not run or unavailable. Values are rounded to 2 decimals by `compute_clocks.py`. Units: `a` years, `1` pace (years per year) or single-CpG β, `kb` for DNAmTL, `score` for raw scores.

- 3: the input did not pass the checks (`out/problems.json` says why).
- 4: pandas or numpy is missing from this interpreter.
- 5: `compute_clocks.py` itself failed; its stderr is in `report.md`.

None of these is replaced with an estimated age.

## IDAT

This skill does not read IDAT files. The upstream SeSAMe workflow runs on the user's own machine, not on the harness server:

1. Clone `https://github.com/gangchen/epiage-skill` and check out `fcf4e3b`.
2. `Rscript epigenetic-clocks/scripts/preprocess_idat.R --check-deps`. If R, Python, a Bioconductor package or a system library is missing, list each item with its purpose and size (say "unknown" when not known) and ask before downloading or installing anything.
3. `Rscript epigenetic-clocks/scripts/preprocess_idat.R --input /path/to/idats --inspect` to identify the array.
4. `Rscript epigenetic-clocks/scripts/preprocess_idat.R --input /path/to/idats --output-dir /path/to/new-output`, which writes `betas.csv` and `qc.csv`.
5. Review `qc.csv` (missingness, detection failures, and `design_mask_available` for MSA), then pass `betas.csv` to `personal_report.py --betas`.

## Boundary

Lead with the numbers the report prints, their units and coverage. "Reading minus age" is a simple difference, not cohort AgeAccel. DunedinPACE and DunedinPoAm are paces, DNAmTL is a telomere surrogate in kb, Garagnani and Bocklandt are single-CpG β values, and exposome and health outputs are raw DNAm scores: none of them is an age, a lab value or a probability. Never report a number for a model the script marks unavailable. Do not tell the user to start or stop a medicine because a clock moved. Copy the report's `边界:` line.

GrimAge has commercial-use restrictions held by UCLA TDG and licensed through the Clock Foundation. DunedinPACE's authors state their algorithm is for research use only; commercial users are referred to TruDiagnostic.
