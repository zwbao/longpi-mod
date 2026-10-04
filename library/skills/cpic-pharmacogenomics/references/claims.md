# Claims

Primary paper: Caudle KE et al., *Genetics in Medicine* 2017;19:215–223, doi:10.1038/gim.2016.87 (PMC5253119, CC BY 4.0). It fixes the words every CPIC guideline uses for allele function and phenotype:

> "Final consensus terms included one set of terms to describe allele functional status and three sets of terms describing inferred phenotype depending on the type of pharmacogene: (i) drug-metabolizing enzymes (e.g., CYP2D6, DYPD, and TPMT), (ii) transporters (e.g., SLCO1B1), and (iii) high-risk genotypes (e.g., HLA-B)"

> "The final terms presented in Table 2 will be used in all new and updated CPIC guidelines"

The numbers the skill uses (allele function, activity values, the diplotype-to-phenotype rules, and each recommendation row with its classification strength) are not retyped from papers. They are CPIC's curated database, read from `https://api.cpicpgx.org/v1/` on 2026-09-29 (latest change-log entry 2026-08-03; cpic-data release v1.60.1) by `scripts/build_cpic_tables.py` into `data/cpic_tables.json`. CPIC's terms (`data/LICENSE-CPIC.md`): "All curated content published by CPIC is available free of restriction under the CC0 1.0 Universal (CC0 1.0) Public Domain Dedication." No ClinPGx/PharmGKB clinical annotations (CC BY-SA) are used.

## Guidelines behind the recommendation rows

| Drugs | Genes | Guideline |
| --- | --- | --- |
| clopidogrel | CYP2C19 | Lee et al. 2022, doi:10.1002/cpt.2526 |
| omeprazole, lansoprazole, pantoprazole, dexlansoprazole | CYP2C19 | Lima et al. 2021, doi:10.1002/cpt.2015 |
| voriconazole (adult rows only) | CYP2C19 | Moriyama et al. 2017, doi:10.1002/cpt.583 |
| citalopram, escitalopram, sertraline, paroxetine, fluvoxamine, venlafaxine, vortioxetine | CYP2C19, CYP2D6, CYP2B6 | Bousman et al. 2023, doi:10.1002/cpt.2903 |
| amitriptyline, nortriptyline, clomipramine, desipramine, doxepin, imipramine, trimipramine | CYP2D6, CYP2C19 | Hicks et al. 2017, doi:10.1002/cpt.597 |
| celecoxib, flurbiprofen, ibuprofen, lornoxicam, meloxicam, piroxicam, tenoxicam | CYP2C9 | Theken et al. 2020, doi:10.1002/cpt.1830 |
| phenytoin, fosphenytoin | CYP2C9, HLA-B | Karnes et al. 2021, doi:10.1002/cpt.2008 |
| seven statins | SLCO1B1, ABCG2, CYP2C9 | Cooper-DeHoff et al. 2022, doi:10.1002/cpt.2557 |
| azathioprine, mercaptopurine, thioguanine | TPMT, NUDT15 | Maillard et al. 2026, doi:10.1002/cpt.70209 |
| fluorouracil, capecitabine | DPYD | Amstutz et al. 2018, doi:10.1002/cpt.911 |
| tacrolimus | CYP3A5 | Birdwell et al. 2015, doi:10.1002/cpt.113 |
| codeine, tramadol, hydrocodone | CYP2D6 | Crews et al. 2021, doi:10.1002/cpt.2149 |
| tamoxifen | CYP2D6 | Goetz et al. 2018, doi:10.1002/cpt.1007 |
| metoprolol | CYP2D6 | Duarte et al. 2024, doi:10.1002/cpt.3351 |
| allopurinol | HLA-B | Saito et al. 2016, doi:10.1002/cpt.161 |
| carbamazepine, oxcarbazepine | HLA-A, HLA-B | Phillips et al. 2018, doi:10.1002/cpt.1004 |
| warfarin | CYP2C9, VKORC1, CYP4F2 | Johnson et al. 2017, doi:10.1002/cpt.668 |

Warfarin has no table rows in the database; the guideline is a flow chart. Johnson et al. 2017 (PMC5546947): "In patients who self-identify as non-African ancestry, the recommendation, as summarized in Figure 2 , is to: 1) calculate warfarin dosing using a published pharmacogenetic algorithm ( 16 , 17 ), including genotype information for VKORC1-1639G>A and CYP2C9 * 2 and * 3." The report says the prescriber does that calculation and shows the genotypes; it computes no dose.

Clopidogrel (Lee et al. 2022, abstract): "CYP2C19 intermediate and poor metabolizers who receive clopidogrel experience reduced platelet inhibition and increased risk for major adverse cardiovascular and cerebrovascular events."

Not covered: atomoxetine (paediatric ADHD dosing schedules), efavirenz and methadone (CYP2B6), atazanavir (UGT1A1*28), abacavir, ondansetron/tropisetron (no rows in the database on the access date), G6PD, RYR1/CACNA1S, MT-RNR1, NAT2, IFNL3, CFTR. Paediatric population rows (voriconazole) are dropped; this library is for adults.

## What the array can and cannot type

| Gene | rsIDs read | CPIC alleles looked for |
| --- | --- | --- |
| CYP2C19 | rs4244285, rs4986893, rs28399504, rs12248560 | *2, *3, *4, *17 (reference shown as *1; CPIC's reference sequence is *38) |
| CYP2C9 | rs1799853, rs1057910, rs72558187 | *2, *3, *13 |
| TPMT | rs1800462, rs1800460, rs1142345 | *2, *3A, *3B, *3C |
| NUDT15 | rs116855232 | *3 |
| DPYD | rs3918290, rs55886062, rs67376798, rs75017182, rs56038477 | c.1905+1G>A (*2A), c.1679T>G (*13), c.2846A>T, c.1129-5923C>G, HapB3 |
| CYP3A5 | rs776746, rs10264272 | *3, *6 (*7 is an insertion and is not read) |
| SLCO1B1 | rs4149056 | *5 and *15 (identical at this site; both no function in CPIC) |
| ABCG2 | rs2231142 | reference G / variant T |
| VKORC1, CYP4F2 | rs9923231, rs2108622 | shown for warfarin only |

CPIC's `variantallele` values are on the chromosomal plus strand (they equal the ref/alt of the GRCh38 `g.` change, which a test checks), the same orientation 23andMe states for its files. Three sites are A/T or C/G (rs1800462, rs67376798, rs75017182), so a strand flip there cannot be detected from the letters; the other sites reject letters that are not the plus-strand bases.

How a gene is called: every pair of the alleles above (plus the reference) whose CPIC definitions at the tested sites reproduce the observed genotypes is a candidate; each candidate goes through CPIC's `gene_result_lookup`. A phenotype is reported only when all candidates give the same CPIC lookup value. An allele is looked for only if a site where it cannot carry the reference base was read. Consequences:

- TPMT rs1800460 C/T with rs1142345 T/C is *1/*3A (intermediate) or *3B/*3C (poor). The report says it cannot tell.
- CYP2C19 *4 is defined with Y at rs12248560, so *4 with the *17 base is handled without a separate *4B name.
- "*1" means none of the listed variants was seen, not that the gene has no variant.

Not typed from array data: CYP2D6 (gene deletion *5, duplications, CYP2D6/2D7 hybrids such as *36, often in tandem as *36+*10 in East Asians; the *10 site rs1065852 also sits in *4 and others), HLA-A and HLA-B (need HLA typing), UGT1A1*28 (TA repeat), CYP2B6*6 (needs phase). These genes are taken only from `--diplotypes`. CYP2D6 activity is the sum of CPIC activity values of the two haplotypes as CPIC names them (for example `*36+*10`, `*1x2`); unknown names give Indeterminate.

## Categories

The report never prints CPIC's recommendation text, because it contains doses. Each row is worded by `category_for()` in `scripts/build_cpic_tables.py`, applied to the first sentence of CPIC's `drugrecommendation`:

- none: "No recommendation", "n/a", "No action recommended", or neither TPMT nor NUDT15 assigned.
- avoid (换药或避免): the first sentence says avoid the drug, contraindicated, do not use, or choose/select/prescribe/consider an alternative. "Avoid moderate and strong CYP2D6 inhibitors" (tamoxifen, about other drugs) is not counted.
- standard (按常规): a plain standard start ("Initiate therapy with recommended starting dose", "use at standard dose", "label recommended", "prescribe desired starting dose", "No adjustments needed…"), unless a later sentence asks for slower titration, a lower maintenance dose, awareness of myopathy risk or trough titration. Indication-specific options after a standard start stay standard: the PPI rows "Consider increasing dose by 50-100% for the treatment of H. pylori infection and erosive esophagitis" (normal and rapid metabolizers) and "For chronic therapy (>12 weeks) and efficacy achieved, consider 50% reduction in daily dose" (intermediate and poor metabolizers).
- caution (调整或监测): everything else (reduce, increase, capped or percentage starting dose, drastically reduced).

Every stored row is re-derived by this rule in `tests/test_calls.py`. Rows keep CPIC's id, version and classification (Strong, Moderate, Optional), which the report shows as 推荐强度.

When a drug has indication branches (clopidogrel ACS/PCI, other cardiovascular, neurovascular; phenytoin naive vs >3 months; carbamazepine), every branch is shown and the report says the prescriber decides which applies. When a gene has no result, CPIC's own "No Result" rows are used if they exist (sertraline with CYP2B6, tricyclics with CYP2D6, rosuvastatin with ABCG2); drugs whose genes all lack a result are listed under "needs another test".

## Changes from the VitaClaw/ClawBio version

The ClawBio `pharmgx_reporter.py` (MIT) was read but no code or data was copied. Its hand-written AVOID/CAUTION/STANDARD table is not CPIC's (for example sertraline "standard" for every CYP2C19 phenotype, clozapine and CYP1A2 with no CPIC guideline, esomeprazole which the CPIC PPI guideline does not cover), its caller counted alt alleles without checking phase or strand (CYP2D6 *10 read as `T`, while 23andMe reports the plus-strand `A`), and it called CYP2D6 from arrays. `drug-photo` was only a photo front end; its role is the `--drug` argument (read the name off the box). The PharmGKB-query part of `bio-clinical-databases-pharmacogenomics` is not used (ClinPGx annotations are CC BY-SA and the report must run offline); its activity-score idea is the `--diplotypes` path, using CPIC's own activity values.
