```bash
python3 "$SKILL/scripts/personal_report.py" \
  --genotype genome.txt \
  --medications meds.txt \
  --out out/
```

`genome.txt`（23andMe 格式，合成数据）的几行：

```text
# rsid	chromosome	position	genotype
rs4244285	10	96541616	AA
rs12248560	10	96521657	CC
rs4149056	12	21331549	TC
```

`meds.txt`：

```text
波立维 75mg
阿托伐他汀钙片
```

报告里 CYP2C19 是 *2/*2，慢代谢型；氯吡格雷在「急性冠脉综合征或做过冠脉介入」一栏是「CPIC 建议考虑换药或避免使用（推荐强度：强）」，并写「用药前请把这份结果给开药的医生或药师看」。SLCO1B1 是功能下降，阿托伐他汀是「CPIC 建议调整用法或加强监测」。

有医院的 CYP2D6 检测结果时，另交一个文件：

```bash
printf 'CYP2D6 *36+*10/*10\nHLA-B*58:01 阴性\n' > clinical.txt
python3 "$SKILL/scripts/personal_report.py" --genotype genome.txt --diplotypes clinical.txt --out out/
```

CYP2D6 按 CPIC 活性值相加是 0.5，中间代谢型；别嘌醇按 HLA-B*58:01 阴性是「CPIC 认为可以按常规用法」。
