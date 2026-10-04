---
name: nutrigenetic-variant-panel
description: >-
  Reads three diet-related variants from a consumer genotype raw file
  (23andMe format; WeGene and other exports in the same format; AncestryDNA):
  ALDH2 rs671 (alcohol flushing and oesophageal cancer risk with drinking,
  Brooks et al. PLoS Med 2009), MTHFR rs1801133 C677T (homocysteine, Frosst et
  al. 1995, with the ACMG 2013 caution), and LCT rs4988235 -13910 (lactase
  persistence, Enattah et al. 2002, uninformative in East Asians). APOE
  rs429358/rs7412 is read only with --apoe and only for the LDL-cholesterol
  direction (Bennet et al. JAMA 2007); the dementia interpretation is excluded
  and the report points to a doctor or genetic counsellor. Actions are worded
  as tests to consider or things to discuss with a doctor, never a supplement
  dose. Use when the user asks what their DNA says about drinking, 喝酒脸红,
  folate/MTHFR, lactose intolerance, or diet genes.
---

# 饮食相关的基因位点

用户交基因检测公司导出的原始数据文件。报告看三个位点：喝酒脸红（ALDH2）、叶酸代谢（MTHFR C677T）、乳糖酶（LCT -13910），每个位点说它按论文意味着什么、可以考虑做什么检查或和医生聊什么。不打分，不加总，不给补剂剂量。

APOE 默认不看。只有用户明确要看时才加 `--apoe`，而且只读血脂方向，不解读痴呆风险。VitaClaw 原来的其他位点（咖啡因、维生素 D、Omega-3 等）证据不一致或不能指导饮食，没有放进来。

## Command

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --genotype genome.txt \
  --out out/
```

- `--genotype`: the raw data download. Tab- or comma-separated `rsid chromosome position genotype` (23andMe, WeGene) or `rsid chromosome position allele1 allele2` (AncestryDNA); `.txt`, `.gz`, or a `.zip` holding one text file. Matched by rsID; letters must be plus-strand bases. A site whose letters are not the expected plus-strand pair is reported as not read.
- `--apoe`: optional. Add only when the user asks about APOE; the report then gives the ε genotype and the LDL-cholesterol direction, and says the rest needs a doctor or genetic counsellor.

No file, a file with no genotype rows, or a file with none of the five rsIDs stops with `out/problems.json` and exit code 3. `out/result.json` holds the copy number of each effect allele and, with `--apoe`, the APOE genotype.

引用 `out/report.md`，包括 `边界:` 那一行。依据和取舍见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
