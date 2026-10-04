# Claims

These boundaries are the manuscript's Table 2. A script result does not move a row.

| Claim | What the manuscript supports |
| --- | --- |
| Individual molecular state can be represented | Yes, as whole-blood promoter-methylation deltas on PPI modules. The signal mixes cell composition, activation, exposure, and regulation. |
| An auditable four-layer chain can be generated | Yes. The chain is a mechanism hypothesis. |
| Known interventions are enriched in RA and breast cancer | Partial. Recovery is above the manuscript baseline inside a disease-informed feature space and depends on STITCH coverage. |
| Depression has aggregate positive-control enrichment | No for the combined drug-plus-nutraceutical Recall-10, which was below its baseline. Age-sex nutraceutical splits are exploratory. |
| The aging run discovers geroprotectors | No. Niacin and colchicine are literature-convergent names from a cross-sectional proxy. There is no clinical anti-aging ground truth. |
| Clinical efficacy | Not tested. |
| The system is a complete world model | No. There is no learned state-action-next-state transition. |
| FDA Plausible Mechanism Framework is satisfied | No. The mapping is conceptual. Target engagement and clinical response are outside the script. |

Whole blood is a weak tissue proxy for breast tumors and for the brain. Promoter methylation is not gene expression, protein activity, or drug-target engagement. Multi-target compounds can rank higher because they intersect more modules; say so when `n_targets` is large.

The skill does not add a transition model. Paired pre/post measurements are required before anyone talks about predicting the next molecular state, and this skill does not implement that step.
