"""Counts read from Park et al. 2026 (PMC13590653).

The sex-stratified clock is a multilayer perceptron. Fitted weights are not
printed and are not in github.com/HaileyHryPark/pbmc-aging-snakemake.
"""

from __future__ import annotations

DOI = "10.1038/s41467-026-76737-4"
TITLE = "单细胞免疫衰老轨迹"
FULL_TEXT_READ = True
LEAD = "补充材料是说明文件，不是权重表。仓库和 Zenodo 压缩包也没有保存多层感知机，所以这次不算预测年龄。"
MEASUREMENT = "要算预测年龄，需要按性别分开的外周血单个核细胞单细胞表达。"
BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
DONORS = 1828
FEMALE_DONORS = 1021
MALE_DONORS = 807
FEATURES_BOTH = 6322
FEATURES_FEMALE = 5204
FEATURES_MALE = 4350
SAF_Q = 0.05
