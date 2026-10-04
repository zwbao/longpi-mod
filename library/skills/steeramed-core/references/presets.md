# Presets

`scripts/presets.py` is authoritative. If this table and the code disagree, follow the code.

Shared by every preset:

| Constant | Value |
| --- | --- |
| STRING combined score | ≥ 400 |
| Module overlap | 20–800 genes |
| STITCH score, applied before input | ≥ 200 |
| Modules kept | 100 |
| Features kept | 200 |
| Patient feature count | 50 |
| Minimum target genes in a pair | 3 |
| Minimum non-target genes in a pair | 3 |
| Layer 1 nominal p | < 0.05 |
| Recall K | 5, 10, 20, 50 |
| Individual bootstrap, when requested | 200 |
| Group bootstrap, when requested | 100 |

| Preset | GEO | Delta | K | Caliper | Target count |
| --- | --- | --- | --- | --- | --- |
| `ra` | GSE42861 | matched case/control | 10 | 5 years | 60–300 |
| `breast_cancer` (`bc`) | GSE51032 | matched case/control | 15 | 5 years | 60–300 |
| `depression` (`mdd`) | GSE128235 | matched case/control | 10 | 5 years | ≥ 5, no maximum |
| `aging` (`age`) | GSE40279 | age < 50 mean subtracted from age > 55 | none | none | ≥ 5, no maximum |

Minimum matched controls inside the caliper: 3. Aging does not use sex or K.

Aliases `bc`, `mdd`, and `age` resolve to the canonical preset names.
