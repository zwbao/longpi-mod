```bash
python3 "$SKILL/scripts/personal_report.py" --genotype genome.txt --out out/
```

`genome.txt`（合成数据）：

```text
# rsid	chromosome	position	genotype
rs671	12	112241766	GA
rs1801133	1	11856378	AA
rs4988235	2	136608646	GG
```

报告：ALDH2 带一份 *2，写日本和台湾研究里喝酒时食管鳞癌比值比 3.7–18.1，「可以考虑不喝或少喝酒。已经长期喝酒的，可以和医生聊要不要做胃镜检查」；MTHFR 是 TT，「可以考虑查一次血同型半胱氨酸」，并附 ACMG 对 MTHFR 检测用处的保留意见；乳糖酶 GG，说明这个位点在中国人里区分不了谁耐受乳糖。APOE 一节只说默认不看。

用户明确要看 APOE 时：

```bash
python3 "$SKILL/scripts/personal_report.py" --genotype genome.txt --apoe --out out/
```
