用户提供基因检测公司导出的原始数据文件（23andMe 格式；WeGene 等国内检测导出的同格式文件），或者医院药物基因检测报告上的星号结果，可以再加现用药和想问的药名。
技能自己带 CPIC 数据库的快照（等位基因功能、表型规则、按表型的用药推荐，CC0），不让用户去下载 PharmGKB、ClinPGx、指南 PDF，也不联网。
报告可以说每个基因推断出的 CPIC 代谢类型，以及每个药按 CPIC 属于换药或避免、调整或监测、按常规、没有推荐中的哪一种；前两种写「用药前请把这份结果给开药的医生或药师看」。报告不写剂量，不说开始或停用任何药，芯片判断不了的基因（CYP2D6、HLA、UGT1A1*28、CYP2B6）只说需要临床检测。

## 文件格式的假定

- 23andMe 文件头写明基因型按 GRCh37 正链报告；本技能只按 rsID 匹配，不用位置。
- WeGene：没有找到官方格式说明。WeGene 社区的回答（https://www.wegene.com/question/1145）说它的原始数据和 23andMe 一样是制表符分隔的 rsid、染色体、位置、基因型，按 build 37 和正链，约 15 行 `#` 注释，半合子也写两个字母。本技能按这个读，并用非回文位点的碱基核对方向：碱基对不上 CPIC 的正链碱基时，那个位点不用，报告写出来。
- 两个技能（本技能和 nutrigenetic-variant-panel）共用同一个 `scripts/genotype_file.py`。仓库只通过 `tools/skillkit` 共享代码，不能改 `tools/`，所以两份是复制件，测试检查两份一致。

## 数据快照

`data/cpic_tables.json` 由 `python3 scripts/build_cpic_tables.py --raw DIR --fetch --accessed YYYY-MM-DD` 生成，`skill.json` 的 `data_files` 记着它的 sha256。更新快照后要重跑测试、更新 sha256，并检查 `tests/test_calls.py` 里的类别规则是否仍然覆盖所有推荐原文。
