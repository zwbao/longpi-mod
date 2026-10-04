# LongPi: a longevity coach that lives in Claude Code

[简体中文](README.md) | English

LongPi turns [Claude Code](https://claude.com/claude-code) into a personal longevity coach. It is a Claude Code mod
(a plugin of function hooks). Give it a checkup report and it files the values as printed into a health record on
your computer. Then it computes your body age and ten-year cardiovascular risk, drafts a plan, keeps your check-ins
and reminds you of retests. The health pages, the Longevity Codex with its pack-opening and card-turning animations,
and the road to 120 are all drawn inside Claude Code; nothing opens a web page.

It is a full port of [dsh-plugin-longpi](https://github.com/zwbao/dsh-plugin-longpi), and it needs nothing else:

- The **method library** ([longevity-skills](https://github.com/zwbao/longevity-skills), 180 methods), the **coach**
  ([longevity-coach](https://github.com/zwbao/longevity-coach-skill)) and **deep analysis**
  ([longevity-analyst](https://github.com/zwbao/longevity-analyst-skill)) ship inside the mod.
- **No Mirobody**: the record is a file on your computer (`~/.longpi`). Claude reads each report itself and files
  the values as printed, and an Apple Health export imports in one step.
- **New research every week**: once a week LongPi searches PubMed for the past week's strongest aging papers
  (randomized trials, meta-analyses, large cohorts) and writes them up as Codex research cards under the Codex copy
  rules.

## Install

Requires Claude Code 2.1.287 or later.

```
/plugin marketplace add zwbao/longpi-mod
/plugin install longpi@longpi-mod
/reload-plugins
```

Then type `/longpi`. On first use LongPi sets up its calculation environment in the background, once, in a few
minutes. Most methods need only the system's Python 3.9+. The few that need numpy get a venv in `~/.longpi/.venv`,
set up through [uv](https://github.com/astral-sh/uv). Your system Python and shell profile are left alone.

LongPi's tools are named `mcp__longpi__*`. To stop being asked about them: `/permissions` → allow `mcp__longpi__*`.

## Use

| | |
|---|---|
| Drop a checkup report into the chat | "file this report": Claude reads the PDF or photo, files every value as printed, and talks you through it |
| `/longpi` | the health pages: overview, labs, sleep, training, calendar, plan, Codex; `m` for more (road to 120, deep analysis, profile, settings…) |
| `/longpi <question>` | ask Pi in your own words, with your record attached (for the model only) |
| `/longpi 图鉴` · `/longpi 通往120` · `/longpi 方案` | open a page directly |
| `/longpi 新研究` | look for this week's new research now |
| `/longpi setup` | update the method library and set up the environment again |
| `/longpi 演示模式` | hide every personal number while you share your screen |
| Apple Health | iPhone Health → your picture → Export All Health Data; give Claude the path of export.zip |

The row above the prompt says one thing at a time: a stand-up reminder (if you turned it on), an experiment card
ready to turn over, or new research cards this week.

## What's inside

- **Health pages**: body age (PhenoAge) and ten-year cardiovascular risk (China-PAR), changes beyond normal
  fluctuation, today's check-ins, retest dates, a brief for your doctor. Model estimates are labeled as such.
- **Longevity Codex**: two-week mini experiments that come in packs. Opening a pack, dealing, flipping and the
  reveal are pixel animations in the terminal. The library holds research cards colored by evidence: bronze for cell
  studies, silver for animals, purple for human observational studies, gold for human randomized trials.
- **The road to 120**: your companion Pi grows from an egg into "100-year-old Pi". There is a twelve-station road, a
  medal wall, and "today's three things". A new station, a new form or a medal each plays a celebration once.
- **Pi the coach**: in conversation Claude speaks as Pi, gives concrete, graded advice, and says plainly when to see
  a doctor.
- **Deep analysis**: Claude runs longevity-analyst over the whole record, and the result feeds back into the plan.

### The game's rules

LongPi tries to make looking after your health something you want to come back to, the way a game does, without
the game ever misleading you:

- Pi grows only with **things that leave a record**: a report filed, a home measurement, a research card read, an
  experiment started or revealed, a retest, a doctor's visit with the brief, a family member added, a method run.
- **Check-ins earn nothing**, because nobody can verify them and rewarding them rewards lying. Lab values earn
  nothing either: rewards are never tied to whether a number is good or bad.
- No draws, rarities, streaks, daily chests or caps, and no feature is locked behind progress. Totals only go up.
- A good result is praised as it is, without claiming which habit caused it.

## Privacy

Your record, plan and check-ins stay on your computer in `~/.longpi` (set `LONGPI_HOME` to move it). Reports, photos and
questions you give Claude go to the model as they always do with Claude; the record summary LongPi attaches is for the
model only and stays out of the transcript. The weekly research search sends only search terms to PubMed. Profile → Privacy lets you withdraw consent and delete
everything.

## Limits

- Not a diagnosis and not medication advice. In an emergency call your local emergency number.
- Live upload for "research together" is off in this local version.
- Body age needs nine routine blood tests from the same day. Cardiovascular risk needs an age of 35–74 and six facts
  about your history.

## Develop

```
claude plugin validate .
claude plugin test .
tsc -p .            # needs the .claude-plugin/types Claude Code writes
```

`hooks/core` is dsh-plugin-longpi's server code, running on the Node-shaped shims in `hooks/sys`. The pages live in
`hooks/ui`. `hooks/app` is the mod's own part: filing records, Apple Health, the weekly research, the road to 120,
and the runtime.

## Licence

MIT, see [LICENSE](LICENSE). The bundled method library, coach and analysis skills keep their own licences and
third-party notices, listed in [NOTICE](NOTICE).
