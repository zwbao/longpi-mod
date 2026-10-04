# Pipeline

Personal reports download reference data through `scripts/prepare_reference.py` and score one sample through `scripts/personal_report.py`. The cache is `~/.cache/steeramed-core/`. Do not ask the user for these files.

| File | Source |
| --- | --- |
| 450k GENCODE manifest | zhou-lab InfiniumAnnotationData `HM450.hg19.manifest.gencode.v26lift37.tsv.gz` |
| STRING v12 human links and info | stringdb-downloads.org, combined score ≥ 400 |
| STITCH v5 human chemical links | stitch-db.org, score ≥ 200 |
| ATC chemical ids | STITCH `chemical.sources.v5.0.tsv.gz`, source column `ATC` |
| Cohort betas | GEO series matrix for the preset |

ATC is the operational stand-in for the manuscript's "FDA-approved or clinically annotated" pool. Promoter CpGs are those with GENCODE `distToTSS` from -1500 to 0.

Display names come from STITCH aliases of those ATC chemicals. `choose_display_name` drops ATC codes and CID-like strings. The personal report prints that name. Current medicines are matched to the name, the chemical id, and the aliases, including a short Chinese-to-English map in `scripts/names.py`. A missing name is printed and is not a reason to stop the medicine. Checkup rows from `scripts/labs.py` are report context only: they do not add or remove compounds. `personal_report.py` maps `cg` probe columns through the HM450, EPIC, or EPICv2 GENCODE manifest when the user file is probes rather than gene symbols.

Source manuscript: alphaXiv `2609.steeramed-biomedical-world-model-intervention` (submitted 2026-09-21). The public package [DeepoMe/SteeraMed](https://github.com/DeepoMe/SteeraMed) `steeramed-core` 0.1.0 (pushed 2026-06-01) implements the SA formula, matched-delta helper, evidence-chain schema, and preset constants. It does not build STRING modules, select the top 100 modules, cut the top 200 features, bootstrap, or compute Recall-K. Its CLI draws figures from three stored patient JSON files.

`scripts/presets.py` is the threshold source. This note is the step order.

## Steps

1. **Gene beta.** Promoter methylation is the mean of CpG beta values in TSS1500 and TSS200. The manuscript cohorts are whole blood. The scripts consume a gene-by-sample or sample-by-gene matrix; they do not map CpG probes.
2. **Patient delta.**
   - Matched presets: patient beta minus the mean of same-sex controls inside a 5-year caliper, using up to K controls. If at least 3 and fewer than K controls fall inside the caliper, use all of them. If fewer than 3 do, that patient is unmatched and dropped. `--match-fallback repo` instead drops the caliper and takes the nearest same-sex controls, which is what `steeramed_core.core.delta.match_controls` does.
   - Aging: beta of each person older than 55 minus the mean of people younger than 50. Ages 50 through 55 are excluded. Sex is not used.
3. **PPI modules.** STRING combined score ≥ 400. A module is a protein plus its first-order neighbors. Keep modules whose overlap with the methylation genes has 20–800 genes. `build_modules.py` does this. Module selection below does not reapply the size window, so pass modules that already satisfy it.
4. **Group module selection.** Average each gene's delta across all cases. Inside each module, run a one-sample t-test of those gene means against 0. Keep the 100 smallest p-values. The p-value is a rank key, not a significance claim, and is not multiple-testing corrected. This uses every case, including the patient later ranked.
5. **Compound pool.** STITCH score ≥ 200 is assumed to have been applied before `targets` were written. The script then applies the preset target-count window to `n_targets` (or `len(targets)` when `n_targets` is absent). Positive controls are not exempt.
6. **SA.** For each selected module and pooled compound, require at least 3 target genes and 3 non-target genes inside the module.

   SA = (mean_target − mean_nontarget) / sqrt(var_target / n_target + var_nontarget / n_nontarget)

   Variance uses the sample divisor (ddof = 1). Rank by |SA|. A positive sign means the targets' deltas are higher than the other genes in that module. It does not mean the compound reverses methylation. Do not convert SA to a p-value.
7. **Group feature cut.** Rank eligible pairs by mean |SA| across cases and keep 200. The manuscript's roughly 15,000 eligible pairs are the pairs that survive step 6 inside the 100 modules. Do not also cap compounds per module.
8. **Patient importance.** Among that patient's |SA| values on the 200 features, take the top 50. Importance is how many of those 50 features belong to the compound. It is not the mean |SA| and it is not a vote pooled across patients. Ties break by higher mean |SA|, then compound id.
9. **Four layers.**
   - Layer 1: modules from step 4 whose one-sample t-test on this patient's own gene deltas has nominal p < 0.05. Reported delta is the mean of those gene deltas.
   - Layer 2: compounds ordered by step 8, with the matched module, signed SA, and target genes.
   - Layer 3: hubs, target genes, and hallmark labels already present on the module for the top 10 compounds.
   - Layer 4: only when `--individual-bootstrap` is set. Each resample redraws patients with replacement, repeats the mean-|SA| feature cut, and re-ranks the fixed patient. The stored value is the percentage of resamples in which the compound remains in that patient's top 10. The manuscript uses 200 iterations.
10. **Recall-K.** Fraction of patients with at least one `is_positive` compound in the personal top-K. Baseline = `1 - (1 - n_pos / n_candidates)^K`, using the pool after the target-count window. Fold = recall / baseline.

## Metrics that must stay separate

- Primary Recall-10 in the manuscript (RA 51.7%, breast cancer 20.0%, depression 25.3%, aging 15.9%) uses phenotype-specific pools. Figure 2D uses a different target-count filter and different pool sizes (RA top-10 recovery 7.9% in that panel). Quote the panel that matches the pool actually used.
- The noise-attenuation PPI Recall-10 of 24.0% is a third RA setting. Do not equate it with 51.7%.
- `operational_group_fold` resamples patients and ranks compounds by their mean maximum |SA| on the already selected features. Fold = (positives inside the group top-K) / (K × n_pos / n_candidates). The manuscript's Figure 2B recomputes group-level methylation deltas from resampled cases and controls and does not publish the algebra. Report the script value only under the name `operational_group_fold`.

## Repository divergences

- DeepoMe `rank_compounds_by_importance` adds feature votes across every row of the matrix. Patient ranks in this skill call the one-patient counter. Aging statements such as "30.4% of patients voted for niacin" are patient fractions, not summed votes.
- DeepoMe config records `SEMO_TOP_CHEM_PER_PPI = 10` and `MAX_SEMO_PAIRS = 10000`, and no function reads them. This skill does not apply them.
- DeepoMe positive-control JSON is shorter than the manuscript (RA lists 6 compounds there; the manuscript evaluates 14). Use the compound file the user supplies. Do not treat the repository JSON as the manuscript's Supplementary Table S1.
