# Claims

The panel keeps a variant only when (1) a primary paper shows what the genotype does, (2) the effect is large or consistent enough to state for one person, and (3) there is something concrete to do: a test to consider or a thing to discuss with a doctor. Plus-strand bases were checked against Ensembl REST (GRCh38, strand 1) and against the paper's own frequencies (1000 Genomes phase 3, read 2026-09-29): rs671 G/A, East Asian A 0.174, European A 0; rs1801133 G/A, European A 0.365 (Frosst: "approximately 38% of unselected chromosomes"); rs4988235 G/A, European A 0.508, East Asian A 0; rs429358 T/C, East Asian C 0.086; rs7412 C/T, East Asian T 0.100.

## Kept

| Variant | Primary citation | Sentence the reading rests on | What the report suggests |
| --- | --- | --- | --- |
| ALDH2 rs671 G>A (A = ALDH2*2, Lys) | Brooks et al., *PLoS Med* 2009, doi:10.1371/journal.pmed.1000050 (public domain) | "case control studies in Japan and Taiwan have consistently demonstrated a strong link between the risk of esophageal squamous cell carcinoma ( Figure 3 ) and alcohol consumption in low-activity ALDH2 heterozygotes, with odds ratios (ORs) ranging from 3.7 to 18.1 after adjustment for alcohol consumption." / "ALDH2-deficient patients can then be counseled to reduce alcohol consumption, and high-risk patients can be assessed for endoscopic cancer screening." / "Because of the intensity of this unpleasant response, ALDH2 Lys/Lys homozygotes are unable to consume significant amounts of alcohol. As a result, they are protected against the increased risk of esophageal cancer from alcohol consumption" | 可以考虑不喝或少喝酒；长期饮酒的可以和医生聊要不要做胃镜 |
| MTHFR rs1801133 G>A (A = 677T) | Frosst et al., *Nat Genet* 1995, doi:10.1038/ng0595-111 | "The mutation in the heterozygous or homozygous state correlates with reduced enzyme activity and increased thermolability in lymphocyte extracts" / "individuals homozygous for the mutation have significantly elevated plasma homocysteine levels." | TT only: 可以考虑查一次血同型半胱氨酸，偏高再和医生聊；不凭基因型自己加补剂 |
| LCT rs4988235 G>A (A = -13910T, persistence) | Enattah et al., *Nat Genet* 2002, doi:10.1038/ng826 | "a DNA variant, C/T-13910, roughly 14 kb upstream from the LCT locus, completely associates with biochemically verified lactase non-persistence in Finnish families and a sample set of 236 individuals from four different populations." | GG: 喝奶后不适时可以考虑少量多次、和饭一起喝、选酸奶或低乳糖奶；症状重时和医生聊。The report says the site cannot separate tolerant from intolerant Chinese adults, because the T allele is absent in the 1000 Genomes East Asian samples. |
| APOE rs429358 + rs7412 (only with `--apoe`) | Bennet et al., *JAMA* 2007, doi:10.1001/jama.298.11.1300 | "There were approximately linear relationships of apoE genotypes (when ordered epsilon2/epsilon2, epsilon2/epsilon3, epsilon2/epsilon4, epsilon3/epsilon3, epsilon3/epsilon4, epsilon4/epsilon4) with LDL-C and with coronary risk." | 可以考虑查一次血脂（看低密度脂蛋白胆固醇），按结果和医生聊 |

MTHFR caveat, shown with every 677T result: Hickey et al., ACMG Practice Guideline, *Genet Med* 2013, doi:10.1038/gim.2012.165: "There is growing evidence that MTHFR polymorphism testing has minimal clinical utility and, therefore should not be ordered as a part of a routine evaluation for thrombophilia." So the report points to the blood homocysteine test, not to the genotype, and never to methylfolate or any dose.

ALDH2 also has a meta-analysis (Lewis and Davey Smith, *Cancer Epidemiol Biomarkers Prev* 2005, doi:10.1158/1055-9965.EPI-05-0196): risk "increased among heterozygotes (OR, 3.19; 95% CI, 1.86-5.47) relative to *1*1 homozygotes" and "reduced among *2*2 homozygotes". It agrees with the reading above and is not quoted in the report.

## APOE: dementia interpretation excluded

Choice: exclude the Alzheimer's interpretation, keep APOE off by default, and when the user asks, read only the LDL-cholesterol direction with a one-line pointer: 「APOE 还和其他疾病（包括老年痴呆）的风险有关。这份饮食报告不解读那一部分。想了解的话，先和医生或遗传咨询师聊，再决定要不要看。」

Why:

1. The joint ACMG/NSGC practice guideline (Goldman et al., *Genet Med* 2011, doi:10.1097/GIM.0b013e31821d69b8) describes APOE testing for Alzheimer disease as of "limited utility" and says "testing individuals for apolipoprotein E can be valuable and safe in certain contexts"; the guideline itself is about "providing the key elements of genetic counseling for AD". A diet report that a person ran to ask about drinking or milk is not that context, and a counselling note inside it would not be counselling.
2. No well-supported diet action is specific to ε4 dementia risk, so including it would add fear without an action. The lipid reading has one (a lipid test), which is why APOE is kept at all.
3. People who do ask about APOE and dementia are routed to the library's APOE skills (`serum-proteomics-apoe-signatures`, `proteomic-apoe-alzheimers-signatures`), which are built for that question.
4. Printing ε4 by default would disclose it implicitly, so APOE needs an explicit request (`--apoe`).

rs429358 C/T with rs7412 C/T is called ε2/ε4 with a note that the rare ε1/ε3 cannot be excluded; other rare combinations are not named.

## Dropped from the VitaClaw panel (28 SNPs)

| Dropped | Why |
| --- | --- |
| CYP1A2 rs762551, AHR rs4410790 (caffeine) | The coffee–myocardial infarction interaction came from one Costa Rican case-control study (Cornelis et al., *JAMA* 2006, doi:10.1001/jama.295.10.1135). In 347,077 UK Biobank participants, "There was no evidence for an interaction between the CYP1A2 genotype or caffeine-GS and coffee intake with respect to risk of CVD (P ≥ 0.53)" (Zhou and Hyppönen, *Am J Clin Nutr* 2019, doi:10.1093/ajcn/nqy297). No action follows. |
| MTHFR rs1801131 (A1298C), MTR rs1805087 | Small or inconsistent effects on homocysteine; the ACMG caution above applies even more. |
| VDR rs2228570, rs731236; GC rs4588 | Vitamin D status is measured directly (25-hydroxyvitamin D); the genotype does not change what to test. |
| FADS1 rs174546, FADS2 rs1535, ELOVL2 rs953413 | Real associations with blood fatty-acid levels, but no genotype-specific diet advice has been shown. |
| BCMO1 rs7501331, rs12934922; SLC23A1; ALPL | Conversion or transport differences with no outcome evidence for one person. |
| FTO, TCF7L2, PPARG, APOA5 | Genome-wide associations with small per-allele effects; the diet advice would be the same for everyone. |
| SOD2, GPX1, NQO1, COMT | "Antioxidant" framing is marketing-grade; no outcome evidence for supplement choices. |
| ADH1B rs1229984 | Well supported for alcohol metabolism, but its only action (drink less) is the same as ALDH2's, so it is not listed separately. |
| VitaClaw's per-domain weights and "risk scores" | Not from any paper; nothing is scored or summed here. |

VitaClaw's panel also had rs4988235 backwards (it counted the plus-strand A as the non-persistence allele; A is -13910T, persistence). It stored MTHFR on the gene strand (C/T) and complemented any genotype lacking the risk letter, so a plus-strand AA became TT (right by accident) but the common GG became an "allele_mismatch" instead of 0 copies. This skill reads plus-strand letters only and refuses letters that are not the expected pair. No VitaClaw/ClawBio code or data was copied.
