---
name: synergy-age
description: >-
  Queries SynergyAge for model-organism genetic lifespan effects and
  synergistic or antagonistic interactions between those interventions. Use
  when the user mentions SynergyAge, epistasis, genetic synergy, or combined
  gene interventions that change lifespan. Interaction labels are experimental
  comparisons, not a reason to start or stop a human treatment.
---

# SynergyAge

Read the SynergyAge MCP tools. The server is `synergy-age` in `.cursor/mcp.json` (`uvx synergy-age-mcp`, package 0.1.0, upstream `longevity-genie/synergy-age-mcp` `af1f1fc`). The database is read-only.

## Order

1. `get_schema_info`
2. `example_queries`
3. `db_query` with a single `SELECT`

Two tables: `models` (one genetic intervention and its lifespan effect) and `model_interactions` (a pairwise comparison, joined on model id). Gene symbols live in a text field. Search with `LIKE '%daf-2%'`. Order lifespan increases with `effect DESC` and decreases with `effect ASC`.

Name the organism (`tax_id`), both genotypes, the interaction label, and the recorded lifespan effect. A synergistic label is a comparison between two experimental models. It is not a human dose, a drug combination, or a reason to start or stop a medicine.
