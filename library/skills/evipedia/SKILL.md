---
name: evipedia
description: >-
  Reads Forever Healthy evipedia.ai evidence reviews of health and longevity
  interventions. Use when the user asks what the evidence says about an
  intervention, names Evipedia, or asks which reviews were published or
  revised. A review conclusion is not a prescription.
---

# Evipedia

Use the `evipedia` MCP server in `.cursor/mcp.json` (`npx -y evipedia-mcp`, package 0.1.30, upstream `forever-healthy/evipedia-mcp` `b94febd`).

## Which tool

- A named intervention: `search_reviews`, then `get_conclusion` on the slug. That is the bottom line.
- Full methodology, safety, dosing, and references: `get_review`. Reviews are long. Read one only when the user asks for the review itself.
- Dates, alternate names, and PMIDs: `get_metadata`.
- What changed recently: `list_updates`. The default window is 7 days. Pass `days` only when the user names a wider window.
- The whole catalogue: `list_reviews`.

`suggest_review` sends a message to the Evipedia team. Call it only after the user explicitly asks to propose a missing review, and only after `search_reviews` shows no match.

Quote the conclusion you received. If the catalogue has no review, say so and stop. Do not fill the gap from memory and label it an Evipedia conclusion. Do not tell the user to start or stop the intervention.
