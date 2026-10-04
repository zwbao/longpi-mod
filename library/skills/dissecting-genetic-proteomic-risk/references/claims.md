# Claims

Full text was read from the local PDF and from Europe PMC `PMC12823428`. The method repository is `https://github.com/VasiliosRaptis/deliriumGen`, cloned to `/tmp/paper-code/p24`. A similarly named project would be another delirium GWAS pipeline. This clone's scripts call REGENIE, METAL, HDL, MTAG, and glmnet on Edinburgh cluster paths. It does not contain the fitted LASSO coefficients or the 18 stability-selected names.

| What the paper states | What the code computes | What is missing |
| --- | --- | --- |
| GWAMA lead variant rs429358 T>C, OR 1.60 (1.55–1.65), P = 9.7×10^−177. rs7412 C>T, OR 0.84 (0.79–0.88), P = 1.8×10^−11. Genome-wide line is 5×10^−8 (Figure 1). Liability-scale SNP heritability is 0.029, with population prevalence K = 0.015 and UK Biobank prevalence P = 0.018. | GWAS scripts are in `ukb.delirium.gwas/`. Summary statistics are not shipped as a scoring file. | Genotypes are echoed. The published ORs and the liability conversion are not multiplied into a personal risk. ε4 is rs429358-C and rs7412-C. Ambiguous double heterozygotes are not counted. |
| Age- and sex-adjusted mediation: direct-effect OR 1.14 (one ε4 copy) and 1.29 (two copies). | `medflex` is called in the analysis scripts. The fitted natural-effect model is not shipped. | Copy count can be reported. The direct-effect odds ratios are not applied to that count. |
| PWAS of 2,919 proteins in 32,652 people (541 cases). 109 proteins at Bonferroni P = 1.7×10^−5 (Figure 5a). Dementia-free subset: 75 proteins (Figure 5b). | `source_data/fig5a.csv` and `fig5b.csv` store protein, OR, and P. The script keeps rows with P < 1.7×10^−5. | The user's level is printed beside a symbol. It is not a weight. |
| Stability selection found 19 proteins; stepwise regression dropped FGL1, leaving 18 (Figure 6, Supplementary Table 9). Dementia-free selection frequency > 0.5 named AREG and MSLN. | `proteomics/stabsel_scripts/01_cv_and_stabsel.R` uses binomial LASSO, 5 folds, seed 1234, B = 100, drops proteins with < 80% non-missing values, and writes frequencies to an Eddie path. The notebook comment keeps frequency ≥ 0.5. | The frequency table is not in the clone. The 18 names are not invented. |
| Table 1 lists 11 proteins with PWAS and MR support and a druggability tier. | No drug-name table is in the repository. | Tiers are protein classes, not prescriptions. |
| Test-set size in Figure 6: 105 cases and 6,378 controls. Dementia-free AUC moved from 0.758 to 0.79 (P = 0.13). | `source_data/fig6.csv` stores predicted probabilities, not coefficients. | No personal probability is computed. |

Checkup values are printed as supplied. They are not paper thresholds and do not edit the protein list.
