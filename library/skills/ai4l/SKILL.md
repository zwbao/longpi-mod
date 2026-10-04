---
name: ai4l
description: >-
  Writes or discusses a Forever Healthy AI4L evidence review of a health or
  longevity intervention. Use when the user asks for an AI4L evidence review,
  an audited intervention review, or an evidence-first conversation about
  whether an intervention works. A finished review is not a prescription.
---

# AI4L

Upstream is [forever-healthy/AI4L](https://github.com/forever-healthy/AI4L) 1.3.29 (`c3ea3e9`), MIT, Forever Healthy Foundation. The protocol in this skill is that release.

Look up an existing Evipedia review with the `evipedia` skill before writing anything. If `get_conclusion` returns a review, give that conclusion. Write a new review only when the user asks for one.

## Written review

Read [references/AI4L.md](references/AI4L.md) in chunks of at most 250 lines, from the top, until the file ends. Write the review only from that protocol. Save the markdown file under the filename the protocol specifies, in the directory the user names, or in `creation/` when they name none.

Do not read an existing evidence review or audit while creating one. Do not shorten the checklist. [references/Limitations.md](references/Limitations.md) still applies after a checklist pass: a pass means the checklist was met, not that every claim is medically correct.

## Conversation

When the user wants a discussion rather than a review file, follow [references/PERSONA.md](references/PERSONA.md). Check Evipedia first. Grade benefits and risks only as that file specifies. Verify a PMID, NCT id, or DOI before showing it; omit a link that was not retrieved.

Do not file an Evipedia suggestion unless the user explicitly asks. Do not tell the user to start or stop an intervention. The closing line of any user-facing answer states that the review supports judgment and does not replace medical care.
