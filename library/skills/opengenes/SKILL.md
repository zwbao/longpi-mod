---
name: opengenes
description: >-
  Queries the OpenGenes database for lifespan-change experiments, hallmarks of
  aging, gene criteria, and human longevity-variant associations. Use when the
  user mentions OpenGenes, a gene's aging evidence, model-organism lifespan
  interventions, or hallmarks tied to a gene. Model-organism effects are not
  a reason to start or stop a human treatment.
---

# OpenGenes

Read the OpenGenes MCP tools. The server is `opengenes` in `.cursor/mcp.json` (`uvx opengenes-mcp`, package 0.2.0, upstream `longevity-genie/opengenes-mcp` `02accbd`). The database is read-only and refreshes from Hugging Face on startup.

## Order

1. `get_schema_info`
2. `example_queries`
3. `db_query` with a single `SELECT`

Four tables, joined on `HGNC`: `lifespan_change`, `gene_criteria`, `gene_hallmarks`, `longevity_associations`. A question about one gene's aging evidence queries all four.

`gene_hallmarks."hallmarks of aging"`, `intervention_improves`, and `intervention_deteriorates` are multi-value. Filter them with `LIKE '%...%'`. When a lifespan question does not say mean or maximum, return both `lifespan_percent_change_mean` and `lifespan_percent_change_max`. Order increases with `DESC` and decreases with `ASC`.

## Boundary

Report the organism, the intervention method, and whether the row is a population association. A worm, fly, or mouse lifespan change is not a human treatment effect. Do not tell the user to start or stop a medicine.
