# Claims

Full text was read from the NCBI OAI record for `PMC11446180` (Europe PMC `fullTextXML` returned HTTP 500). The JSON lists no GitHub repository. A similarly named project would be a later organ-age clock. This paper's gap is a support-vector predicted age minus chronological age, trained in a previous study on people without self-reported or healthcare-documented lifetime chronic disease, with 20-fold cross-validation. Those weights are not in this text, so they are not stored.

| What the paper states | What this skill computes | What is missing |
| --- | --- | --- |
| Nine systems: brain, cardiovascular, eye, hepatic, immune, metabolic, musculoskeletal, pulmonary, renal. | The nine names are always listed. | No organ is added from labs or from an unknown label. |
| BAG is predicted age minus chronological age. | Subtraction, only when the user supplies a predicted age and `--age`. | No predicted age is invented. |
| European GWAS locus counts at P < 5×10^−8: 11, 44, 17, 41, 61, 76, 24, 67, 52 for brain, cardiovascular, eye, hepatic, immune, metabolic, musculoskeletal, pulmonary, and renal. The nine counts sum to 393. SNP heritability from GCTA: 0.47, 0.27, 0.38, 0.23, 0.21, 0.29, 0.24, 0.36, 0.31 in that same organ order. LDSC was used for the intercepts, not for these heritabilities. | Not printed in the personal report. | Not a personal genotype score. No GWAS weight file is in this paper. |
| Eye model: 88 OCT measures (category 10079), 28 dropped for missingness > 20%, 60 kept; outliers outside mean ± 6 SD. Nine-organ feature count 2,444 (Source Data File 21). | Stated as cohort rules. | The cohort mean is not in the paper text, so ±6 SD is not applied to one person. |
| Gene–drug–disease network from DrugBank enrichment (GREP). | Not scored. | Drug names and weights are not in the extracted text and are not invented. |

Checkup values are printed as supplied. They do not edit the nine organs.
