---
name: cpic-pharmacogenomics
description: >-
  Reads a consumer genotype raw file (23andMe format; WeGene and other exports
  in the same four-column format; AncestryDNA) and/or star-allele results from
  a clinical pharmacogenetic test, calls CPIC diplotypes and phenotypes for
  CYP2C19, CYP2C9, SLCO1B1, ABCG2, TPMT, NUDT15, DPYD and CYP3A5, and looks up
  the CPIC recommendation rows for 50 guideline drugs (clopidogrel, PPIs,
  statins, NSAIDs, SSRIs, tricyclics, thiopurines, fluoropyrimidines,
  tacrolimus, phenytoin, warfarin, and CYP2D6/HLA drugs when a clinical result
  is given). Each drug is worded as avoid/alternative, adjust or monitor,
  standard, or no recommendation, never as a dose; anything but standard gets
  "用药前请把这份结果给开药的医生或药师看". States that array data cannot call
  CYP2D6 (deletion, duplications, *36 hybrids), HLA, UGT1A1*28 or CYP2B6. Use
  when the user asks about drug genes, 药物基因检测, 慢代谢, clopidogrel and
  CYP2C19, statins and SLCO1B1, or shows a pill box together with a raw DNA file.
---

# 用药基因对照（CPIC）

用户交基因检测公司导出的原始数据文件（23andMe 格式，WeGene 等国内检测导出的同格式文件也可以），或者医院药物基因检测报告上的结果，也可以交现用药和想问的药。技能自带 CPIC 数据库的快照，不向用户要 PharmGKB、ClinPGx 或 PDF。

报告先说哪些药要先问医生，再列基因结果、按常规的药、要别的检测才能对照的药，以及芯片判断不了的基因。每个药只写四种说法之一：CPIC 建议考虑换药或避免使用；CPIC 建议调整用法或加强监测；CPIC 认为可以按常规用法；CPIC 对这个结果没有给出推荐。前两种都写「用药前请把这份结果给开药的医生或药师看。」报告不写剂量，不说开始或停用哪个药。

## Command

Set `SKILL` to the directory that contains this file.

```bash
python3 "$SKILL/scripts/personal_report.py" \
  --genotype genome.txt \
  --diplotypes clinical_pgx.txt \
  --medications meds.txt \
  --drug 氯吡格雷 \
  --out out/
```

- `--genotype`: the raw data download. Tab- or comma-separated `rsid chromosome position genotype` (23andMe, WeGene) or `rsid chromosome position allele1 allele2` (AncestryDNA); `.txt`, `.gz`, or a `.zip` holding one text file. Rows are matched by rsID; genotypes must be plus-strand letters. A site whose letters are not the plus-strand bases CPIC lists is not used, and the report says so.
- `--diplotypes`: optional, one gene per line as printed on a clinical report: `CYP2C19 *1/*2`, `CYP2D6 *36+*10/*10`, `CYP2D6 *1x2/*1`, `DPYD *2A/*1`, `HLA-B*58:01 阴性`. A clinical result replaces the array call for that gene. CYP2D6 and HLA can only come in this way.
- `--drug`: optional, repeatable. A name to look up first (Chinese generic, English, or a common brand such as 波立维 or 可定). When the user sends a photo of a pill box, read the generic name off the box and pass it here; the photo itself is not read.
- `--medications`: optional, one medicine per line. Each is matched to a CPIC drug or reported as not in these guidelines, with 「不能据此停」.

No input, a file with no genotype rows, a file with none of the drug-gene sites, or an unreadable `--diplotypes` line stops with `out/problems.json` and exit code 3. `out/result.json` holds each gene's CPIC phenotype and `drugs_to_discuss`.

引用 `out/report.md`，包括 `边界:` 那一行。方法和取舍见 [references/claims.md](references/claims.md) 和 [references/contract.md](references/contract.md)。
