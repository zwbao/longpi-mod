# Third-party notices

The code, skill instructions, manifests and tooling written for this repository are MIT licensed (see [LICENSE](LICENSE)). The files and data listed below come from other people's work. They are **not** relicensed under MIT: each keeps the licence or terms stated here, and the citations say where it came from.

If you hold rights in something listed here and want it credited differently or removed, open an issue.

## Files under their own licence

| Path | Source | Licence |
| --- | --- | --- |
| `skills/ai4l/references/AI4L.md`, `PERSONA.md`, `Limitations.md` | [forever-healthy/AI4L](https://github.com/forever-healthy/AI4L) @ c3ea3e9, unmodified | MIT, © 2026 Forever Healthy Foundation, see `skills/ai4l/LICENSE` |
| `skills/biomcp/` (playbooks, schemas, examples) | [genomoncology/biomcp](https://github.com/genomoncology/biomcp) @ a450303, unmodified | MIT, © 2025 Ian Maurer, see `skills/biomcp/LICENSE` |
| `skills/scepiage-single-cell-ageing/data/ExpectedMethMat_Blood.tsv`, `clockSites_Blood_BackUp.txt` | [EpigenomeClock/scEpiAge](https://github.com/EpigenomeClock/scEpiAge), unmodified copies | GPL-2.0, see `skills/scepiage-single-cell-ageing/data/LICENCE-scEpiAge`. The skill's Python only reads these files as data. |
| `skills/chaperone-autophagy-tissue-aging/data/cmascore_genes.xlsx` | [amsegura/Khawaja_et_al_2024](https://github.com/amsegura/Khawaja_et_al_2024), unmodified | BSD-3-Clause, © 2024 Adrián Martín-Segura; original Tabula Muris Senis data © 2022 Chan Zuckerberg Biohub. See `LICENSE-Khawaja_et_al_2024` beside the file. |
| `skills/plasma-proteomic-cellular-aging/scripts/soma_clock_coefficients_min.csv` | [dingdaisy/cellage](https://github.com/dingdaisy/cellage), unmodified | MIT, © 2026 Daisy Ding, see `LICENSE-cellage` beside the file |
| `skills/longevitybench/scripts/presets.py`, `control_laws.py`, `drugage.py` | Constants copied from and code ported from [Insilico-org/longeclaw](https://github.com/Insilico-org/longeclaw) | MIT, © 2026 Insilico Medicine, see `LICENSE-longeclaw` beside the files |
| `skills/epiage/scripts/compute_clocks.py`, `skills/epiage/references/model-audit.md` | [gangchen/epiage-skill](https://github.com/gangchen/epiage-skill) @ fcf4e3b, unmodified | MIT, © 2026 gangchen, see `skills/epiage/LICENSE-epiage` and `NOTICE-epiage` |
| `skills/epiage/data/` (model coefficient CSVs, `DunedinPACE_Gold_Means.csv`, `sesame_450k_median.csv`, `blood_panel.npz`) | gangchen/epiage-skill @ fcf4e3b, unmodified. Coefficients and medians derived from [bio-learn/biolearn](https://github.com/bio-learn/biolearn) and the original clock papers; `blood_panel.npz` built by epiage-skill from GEO GSE40279 whole-blood 450K data. Per-file sources and SHA-256 are in `skills/epiage/skill.json` `data_files` | MIT (epiage-skill). biolearn's own licence is New BSD (BSD-3-Clause); epiage-skill's NOTICE calls it MIT. See the restrictions below |
| `skills/longevitybench/data/drugage.csv`, and the DrugAge rows in `skills/longevity-evidence/data/claims.jsonl` | DrugAge Build 5, Human Ageing Genomic Resources ([HAGR](https://genomics.senescence.info/drugs/)), via Insilico-org/longeclaw | CC BY 3.0 (HAGR terms). Please cite Barardo D et al., *Aging Cell* 2017;16:594-597, and de Magalhães JP et al., *Nucleic Acids Res* 2024;52:D900-D908. |
| `skills/cpic-pharmacogenomics/data/cpic_tables.json` | CPIC® database, https://api.cpicpgx.org/v1/, read 2026-09-29 (latest change log 2026-08-03; cpic-data release v1.60.1). A subset of the allele function, allele definition, phenotype lookup and recommendation tables, reformatted to JSON by `scripts/build_cpic_tables.py`, which adds one derived `category` field per recommendation row | CC0 1.0 (CPIC curated content), see `LICENSE-CPIC.md` beside the file. CPIC asks for attribution to CPIC and https://www.clinpgx.org, citation of the guideline papers (listed in the skill's paper card), and a note that CPIC content is updated over time. No ClinPGx/PharmGKB annotation data (CC BY-SA) is included. |

Two models in `skills/epiage/data/` carry use restrictions from their owners, which also apply to the same models in `pyaging`:

- GrimAge (`GrimAgeV1.csv`, `GrimAgeV2.csv`): commercial use is restricted by UCLA TDG and licensed through the [Clock Foundation](https://clockfoundation.org/). For cosmetics, life-insurance or any other commercial use, contact the Clock Foundation.
- DunedinPACE (`DunedinPACE.csv`, `DunedinPACE_Gold_Means.csv`): the authors' [danbelsky/DunedinPACE](https://github.com/danbelsky/DunedinPACE) package is GPL-3.0, and its README says the algorithm is for research users only; commercial users are referred to the exclusive licensee TruDiagnostic.

They are included, as in epiage-skill, biolearn and pyaging, for research and personal use.

## Tables from open-access articles (CC BY 4.0)

These skills carry tables taken from the article or its supplementary information: coefficients, gene or protein lists, species statistics. They are subsets, reformatted to CSV or Python, unless the path says otherwise. Each article is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); credit goes to its authors.

| Skill | Article |
| --- | --- |
| `terpenoid-autophagy-sarcopenia` | Herbal terpenoids activate autophagy and mitophagy through modulation of bioenergetics and protect from metabolic stress, sarcopenia and epigenetic aging. *Nature Aging* 2025. https://doi.org/10.1038/s43587-025-00957-4 |
| `replicative-senescence-proteome` | Quantitative proteomics reveals coordinated changes in the proteome during replicative senescence. *Nature Communications* 2026. https://doi.org/10.1038/s41467-026-77686-8 |
| `naked-mole-queen-methylation-clock` | DNA methylation clocks tick in naked mole rats but queens age more slowly than nonbreeders. *Nature Aging* 2021. https://doi.org/10.1038/s43587-021-00152-1 |
| `epigenetic-aging-naked-mole` | Epigenetic aging of the demographically non-aging naked mole-rat. *Nature Communications* 2022. https://doi.org/10.1038/s41467-022-27959-9 |
| `mammal-somatic-mutation-lifespan` | Somatic mutation rates scale with lifespan across mammals. *Nature* 2022. https://doi.org/10.1038/s41586-022-04618-z |
| `scepiage-single-cell-ageing` | scEpiAge: an age predictor highlighting single-cell ageing heterogeneity in mouse blood. *Nature Communications* 2024. https://doi.org/10.1038/s41467-024-51833-5 |
| `plasma-proteomic-cellular-aging` | Plasma proteomic signatures of cellular aging predict human disease. *Nature Medicine* 2026. https://doi.org/10.1038/s41591-026-04446-y |
| `blood-protein-assessment` | Blood protein assessment of leading incident diseases and mortality in the UK Biobank. *Nature Aging* 2024. https://doi.org/10.1038/s43587-024-00655-7 |
| `mammal-cancer-risk-lifespan` | Cancer risk across mammals. *Nature* 2022. https://doi.org/10.1038/s41586-021-04224-5 |
| `proteomic-apoe-alzheimers-signatures` | Proteomic signatures of the APOE ε4 and APOE ε2 genetic variants and Alzheimer’s disease. *Nature Aging* 2026. https://doi.org/10.1038/s43587-026-01123-0 |
| `organ-specific-proteomic-aging` | Organ-specific proteomic aging clocks predict disease and longevity across diverse populations. *Nature Aging* 2025. https://doi.org/10.1038/s43587-025-01016-8 |
| `senescent-cells-gene-set` | A new gene set identifies senescent cells and predicts senescence-associated pathways across tissues. *Nature Communications* 2022. https://doi.org/10.1038/s41467-022-32552-1 |
| `genome-wide-proteomics-frailty` | Large-scale genome-wide analyses with proteomics integration reveal novel loci and biological insights into frailty. *Nature Aging* 2025. https://doi.org/10.1038/s43587-025-00925-y |
| `proteomic-aging-clock` | Proteomic aging clock predicts mortality and risk of common age-related diseases in diverse populations. *Nature Medicine* 2024. https://doi.org/10.1038/s41591-024-03164-7 |
| `plasma-protein-risk-score` | A plasma protein-based risk score to predict hip fractures. *Nature Aging* 2024. https://doi.org/10.1038/s43587-024-00639-7 |
| `dissecting-genetic-proteomic-risk` | Dissecting the genetic and proteomic risk factors for delirium. *Nature Aging* 2025. https://doi.org/10.1038/s43587-025-01018-6 |
| `neuron-aging-clocks` | Aging clocks delineate neuron types vulnerable or resilient to neurodegeneration and identify neuroprotective interventions. *Nature Aging* 2026. https://doi.org/10.1038/s43587-026-01067-5 |
| `hsc-inflammatory-memory` | Human haematopoietic stem cells remember inflammatory stress. *Nature* 2026. https://doi.org/10.1038/s41586-026-10522-7 |
| `blood-epigenetic-intrinsic-capacity` | A blood-based epigenetic clock for intrinsic capacity predicts mortality and is associated with clinical, immunological and lifestyle factors. *Nature Aging* 2025. https://doi.org/10.1038/s43587-025-00883-5 |
| `polygenic-gut-metagenomic-risk` | Integration of polygenic and gut metagenomic risk prediction for common diseases. *Nature Aging* 2024. https://doi.org/10.1038/s43587-024-00590-7 |
| `accelerated-biological-aging-risk` | Accelerated biological aging and risk of depression and anxiety: evidence from 424,299 UK Biobank participants. *Nature Communications* 2023. https://doi.org/10.1038/s41467-023-38013-7 |

`skills/terpenoid-autophagy-sarcopenia/data/43587_2025_957_MOESM3_ESM.xlsx` is the article's Supplementary Tables file, unmodified. The two `mammal-cancer-risk-lifespan` tables are column subsets of the data files in [OrsolyaVincze/VinczeEtal2021Nature](https://github.com/OrsolyaVincze/VinczeEtal2021Nature), which the article names as its data.

## Factual extracts from articles without an open licence

These skills hold model coefficients, cut points or gene lists printed in articles whose licence does not cover redistribution (subscription access, or CC BY-NC-ND). They are included as factual data needed to reproduce the published method, with citation, following the common practice of open-source aging-clock packages. No prose, figures or whole articles are copied. Use them for non-commercial research and personal use; for anything else, check the article's terms.

| Skill | Article | Article licence |
| --- | --- | --- |
| `serum-proteomics-apoe-signatures` | Serum proteomics reveal APOE-ε4-dependent and APOE-ε4-independent protein signatures in Alzheimer’s disease. *Nature Aging* 2024. https://doi.org/10.1038/s43587-024-00693-1 | CC BY-NC-ND 4.0 |
| `immune-aging-clock-runx1` | Human immune aging clock identifies RUNX1 as a decelerator of T cell senescence. *Immunity* 2026. https://doi.org/10.1016/j.immuni.2026.02.007 | no open licence (subscription or unstated) |
| `time-seq-dna-methylation` | TIME-seq reduces time and cost of DNA methylation measurement for epigenetic clock construction. *Nature Aging* 2024. https://doi.org/10.1038/s43587-023-00555-2 | no open licence (subscription or unstated) |
| `apoe2-pericyte-lipid` | The longevity gene APOE2 enhances pericyte function and reduces lipid droplets. *Brain* 2026. https://doi.org/10.1093/brain/awag311 | no open licence (subscription or unstated) |
| `ramanomics-senescence` | RamanOmics decodes the spatial vibrational–molecular architecture of senescence in aging and repair. *Nature Aging* 2026. https://doi.org/10.1038/s43587-026-01219-7 | CC BY-NC-ND 4.0 |
| `nanopore-parent-origin-methylation` | Nanopore sequencing identifies parent-of-origin specific age-associated methylation changes at imprinted loci in the human genome. *Nature Communications* 2026. https://doi.org/10.1038/s41467-026-76240-w | CC BY-NC-ND 4.0 |
| `plasma-proteomics-brain-immune` | Plasma proteomics links brain and immune system aging with healthspan and longevity. *Nature Medicine* 2025. https://doi.org/10.1038/s41591-025-03798-1 | CC BY-NC-ND 4.0 |
| `human-ovarian-aging-multiomics` | Molecular and genetic insights into human ovarian aging from single-nuclei multi-omics analyses. *Nature Aging* 2024. https://doi.org/10.1038/s43587-024-00762-5 | CC BY-NC-ND 4.0 |
| `omniage-mitotic-clonal-hematopoiesis` | The OmniAge compendium of aging omic biomarkers links mitotic clocks to clonal hematopoiesis and causality. *Nature Communications* 2026. https://doi.org/10.1038/s41467-026-76038-w | CC BY-NC-ND 4.0 |
| `metabolomic-frailty-subtypes` | Metabolomic characterization of frailty identifies subtype-specific management strategies. *npj Digital Medicine* 2025. https://doi.org/10.1038/s41746-025-02075-2 | CC BY-NC-ND 4.0 |
| `centenarian-longevity-genes` | Depletion of loss-of-function germline mutations in centenarians reveals longevity genes. *Nature Communications* 2024. https://doi.org/10.1038/s41467-024-52967-2 | CC BY-NC-ND 4.0 |
| `foxo3-osteoarthritis-ferroptosis` | Regulating obesity-induced osteoarthritis by targeting p53-FOXO3, osteoclast ferroptosis, and mesenchymal stem cell adipogenesis. *Nature Communications* 2025. https://doi.org/10.1038/s41467-025-59883-z | CC BY-NC-ND 4.0 |
| `epigenetic-age-single-cells` | Profiling epigenetic age in single cells. *Nature Aging* 2021. https://doi.org/10.1038/s43587-021-00134-3 | no open licence (subscription or unstated) |
| `china-par-ascvd-risk` | Predicting the 10-Year Risks of Atherosclerotic Cardiovascular Disease in Chinese Population: The China-PAR Project (Prediction for ASCVD Risk in China). *Circulation* 2016. https://doi.org/10.1161/circulationaha.116.022367 | no open licence (subscription or unstated) |
| `chaperone-autophagy-tissue-aging` | Sex-specific and cell-type-specific changes in chaperone-mediated autophagy across tissues during aging. *Nature Aging* 2025. https://doi.org/10.1038/s43587-024-00799-6 | CC BY-NC-ND 4.0 |
| `uls8-loneliness-scale` | A Short-Form Measure of Loneliness. *Journal of Personality Assessment* 1987. https://doi.org/10.1207/s15327752jpa5101_6 | no open licence (subscription or unstated) |
| `iief5-erectile-function` | Development and evaluation of an abridged, 5-item version of the International Index of Erectile Function (IIEF-5) as a diagnostic tool for erectile dysfunction. *International Journal of Impotence Research* 1999. https://doi.org/10.1038/sj.ijir.3900472 | no open licence (subscription or unstated) |
| `rmeq-chronotype` | Horne & Östberg morningness-eveningness questionnaire: A reduced scale. *Personality and Individual Differences* 1991. https://doi.org/10.1016/0191-8869(91)90110-w | no open licence (subscription or unstated) |
| `ckd-epi-2021-egfr` | New Creatinine- and Cystatin C–Based Equations to Estimate GFR without Race. *New England Journal of Medicine* 2021. https://doi.org/10.1056/nejmoa2102953 (equation coefficients from Table 2 and Table S10; worked values from Table S11) | no open licence (NEJM terms of use) |
| `ckd-epi-2021-egfr` | KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease. *Kidney International* 2024. https://doi.org/10.1016/j.kint.2023.10.018 (GFR and albuminuria cut points, monitoring frequencies and referral thresholds; practice points paraphrased) | CC BY-NC-ND 4.0 |
| `navy-circumference-body-fat` | Waist circumference and waist–hip ratio: report of a WHO expert consultation, Geneva, 8–11 December 2008. World Health Organization, 2011. ISBN 978 92 4 150149 1 (Annex Table A1 waist–hip ratio cut-offs) | © World Health Organization, all rights reserved |
| `navy-circumference-body-fat` | WS/T 428—2013 成人体重判定 (Criteria of weight for adults). National Health and Family Planning Commission of China, 2013 (Table 2 central-obesity waist cut-offs) | Chinese health industry standard (recommended), no open licence stated |
| `navy-circumference-body-fat` | A systematic review of waist-to-height ratio as a screening tool for the prediction of cardiovascular disease and diabetes: 0·5 could be a suitable global boundary value. *Nutrition Research Reviews* 2010. https://doi.org/10.1017/s0954422410000144; and Ashwell M, Hsieh SD, *Int J Food Sci Nutr* 2005, https://doi.org/10.1080/09637480500195066 (the 0.5 boundary only) | no open licence (subscription or unstated) |

`navy-circumference-body-fat` also uses the equations, Siri conversion and Appendix A table cells of two Naval Health Research Center reports, U.S. government works approved for public release (distribution unlimited): Hodgdon JA, Beckett MB. Prediction of percent body fat for U.S. Navy men (Report No. 84-11, DTIC ADA143890) and women (Report No. 84-29, DTIC ADA146456) from body circumferences and height, 1984.

`skills/immune-aging-clock-runx1/scripts/table_s3.csv` is the article's whole Table S3 (18,851 clock coefficients); the two TIME-Seq clock files are unmodified copies from [patricktgriffin/TIME-Seq](https://github.com/patricktgriffin/TIME-Seq), which carries no licence and whose values the article also prints in Supplementary Table 6.

### Questionnaires: scoring rules only, no item wording

These skills hold only a questionnaire's scoring rules (item score ranges, reverse-scored items, totals) and its published cut-points, taken from the article's abstract or from open-access papers that quote it; each skill's `references/contract.md` gives the quotations. The item wording is not reproduced: each item is described by its number and a short topic, and a person answers on a published or licensed copy.

| Skill | Instrument and rights holder | Ported from |
| --- | --- | --- |
| `uls8-loneliness-scale` | ULS-8. The items come from the Revised UCLA Loneliness Scale (Russell, Peplau and Cutrona, *J Pers Soc Psychol* 1980). | VitaClaw `social-health-tracker` |
| `iief5-erectile-function` | IIEF-5 (Sexual Health Inventory for Men). Copyright Pfizer Inc., distributed by [Mapi Research Trust](https://eprovide.mapi-trust.org/instruments/international-index-of-erectile-function); it may not be copied, retyped, translated or modified without their written permission. | VitaClaw `sexual-health-analyzer` |
| `rmeq-chronotype` | rMEQ: items 1, 7, 10, 18 and 19 of the Horne–Östberg Morningness–Eveningness Questionnaire, copyright © 1976 Gordon and Breach Science Publishers. | VitaClaw `circadian-rhythm-optimizer` |

[VitaClaw](https://github.com/vitaclaw/vitaclaw) is MIT licensed according to its README, and the skills ported from it are prose only. No VitaClaw code or text is included; the scoring was rebuilt from the sources above.

## Reference tables in `data/`

- `data/biological_variation.json`: numbers from the journal articles named in each row, with the quoted sentence or table row that prints them. No values from the EFLM Biological Variation Database, whose terms restrict redistribution.
- `data/effects.jsonl`: trial and meta-analysis averages, each with a short quotation (at most a sentence) and its DOI.

