用户提供基因检测公司导出的原始数据文件（23andMe 格式；WeGene 等国内检测导出的同格式文件），用户明确要看 APOE 时再加一个开关。
技能自己带每个位点的正链碱基、依据论文和原文句子，不让用户去查 dbSNP、GWAS Catalog 或论文 PDF。
报告可以说每个位点的份数、按论文它意味着什么，以及「可以考虑…检查/和医生聊」；不给补剂或饮食的剂量，不解读 APOE 的痴呆风险。

读文件用的 `scripts/genotype_file.py` 和 cpic-pharmacogenomics 里的是同一份（仓库只通过 `tools/skillkit` 共享代码，不能改 `tools/`，所以复制，测试检查两份一致）。WeGene 格式的假定和那边相同：制表符分隔、build 37、正链，依据是 WeGene 社区回答 https://www.wegene.com/question/1145，没有找到官方说明；碱基对不上正链碱基对时该位点不读。
