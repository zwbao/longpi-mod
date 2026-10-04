# Claims

Full text was read from NCBI `PMC13590653` (PubMed 42764338). `top100.json` had an empty `pmcid`; `elink` returned no PMC link, and `efetch` still returned the article. The named repository is `https://github.com/HaileyHryPark/pbmc-aging-snakemake`, cloned to `/tmp/paper-code/p28`. It trains elastic-net, XGBoost, and multilayer-perceptron clocks. It does not ship fitted weights.

| What the paper states | What the repository computes | What is missing |
| --- | --- | --- |
| Sex-stratified multilayer perceptrons predict chronological age from sex-aware aging features. Matrices: 1828 donors × 6322 features, 1021 females × 5204 features, 807 males × 4350 features. | Training scripts live under `scripts/internal_clock/` and `scripts/external_clock/`. PMC13590653 supplements are three PDFs (supplementary information, peer review, reporting summary). Zenodo 10.5281/zenodo.21531521 is a 658 KB source zip. | No weight table and no saved model file. Predicted age is not computed. |
| Architecture ranges: 1–3 hidden layers, 64–256 units, ReLU, dropout, Adam, learning rate 1e-4 to 1e-2, up to 50 epochs. | The same ranges are training options, not one fitted network. | A range is not a weight vector. |
| DE-SWAN uses windows of 10, 15, 20, and 25 years and q-value cutoffs from 0.0001 to 0.05. Features with q < 0.05 at any central age are sex-aware aging features. | The snakemake rules rerun that cohort analysis. | A single expression file cannot be scored with these cutoffs alone. |
| Age-associated hypomethylation at SSH3 (chromosome 11q13) is reported in males. | Methylation resources in the clone are probe lists, not a personal cutoff. | No methylation threshold is applied. |

Cohort counts stay here. They are not printed in the personal report. Checkup labs do not create a method list.
