---
name: longevity-evidence
description: >-
  Looks up what the papers collected in longevity-skills state about a drug,
  supplement, diet, gene, protein or other named entity, grouped into human
  studies, animal experiments and cell experiments, with a citation for every
  row. Use when the user asks whether something works for aging (NMN,
  metformin, rapamycin, fasting), what research says about a gene or variant,
  or what the collected papers say about a medicine they take. It never gives
  a dose and never turns an animal result into a human instruction.
---

# 证据查询

用户说出一个药物、补剂、饮食或生活方式干预、基因或蛋白的名字，技能在证据库里查已收录论文对它的说法。证据库在 `data/claims.jsonl`，每一条都照录某篇论文点名的对象和方向，出处写到图表或补充表。这些行从本仓库其他技能冻结的名单里抽出，不是凭记忆补的。

报告先列人群研究，再列动物实验和细胞实验。没有人群研究时，报告第一句就说出来。证据库里没有的名字，报告说没有收录，并指向 Evipedia 综述（`skills/evipedia/`）和 AI4L（`skills/ai4l/`）。没有收录不等于没有研究，也不说明安全或无效。

## Command

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/query.py" \
  --entity NMN \
  --entity 雷帕霉素 \
  --medications MEDS.txt \
  --out out/
```

`--entity` 可以重复，中文名、英文名和别名都能查。`--medications` 一行一个药名，每个药名也会查一遍，报告对每个药名都保留「不能据此停」。

引用 `out/report.md`，包括最后的 `边界:` 一行。`out/result.json` 给出命中条数和其中人群研究的条数。

## 边界

不给剂量，不写开始、停止、加量或减量。动物和细胞实验里的剂量不是用法。风险比和效应大小不在证据库里，不要从别处补。
