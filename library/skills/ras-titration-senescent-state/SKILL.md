---
name: ras-titration-senescent-state
description: >-
  Maps one supplied RAS dose bin onto the published RPE1 or mouse-liver phenotypes from the RAS titration study. It uses the paper's S, M, L, XL and CAGGS, PGK, UBC bins. Use when the user mentions RAS titration, oncogene-induced senescence, NRAS G12V dose, or this Nature paper. Current medicines and checkup labs are context. The report does not say what to start or stop.
---

# 剂量分箱

用户交现用药、体检，以及 `--system rpe1` 或 `--system liver` 和一个剂量箱。不要向用户要 GEO、STRING 或 PDF。

没有箱名时名单是空的。给出箱名时，名单只有对上的那一档。药名对不上时保留「不能据此停」。体检不增删方法算出的名单。

## Command

`SKILL` 是本文件所在目录。

```bash
python "$SKILL/scripts/personal_report.py" \
  --medications meds.txt \
  --labs checkup.csv \
  --system rpe1 \
  --bin XL \
  --out out/
```

`--system` 默认 `rpe1`。`--bin` 在 RPE1 里是 N、S、M、L、XL，在肝脏模型里是 CAGGS、PGK、UBC。`--medications` 与 `--labs` 可省略。IDAT 和 PDF 不读。

把 `out/report.md` 整段交给用户，包括最后一行 `边界:`。方法说明见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
