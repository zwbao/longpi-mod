# 论文、仓库、另一套同名东西

Nature Communications（2026），doi:10.1038/s41467-026-75427-5。全文用 pypdf 从 PDF 抽出。

| | 内容 |
| --- | --- |
| 论文声称 | 用 cNMF 在 29 种细胞类型上各取 30 个模块，模块分数是每个模块前 25 个基因的平均。细胞数少于 400 的 Goblet、Mesothelium、pDCs、HSCs、Ionocytes、PNECs、Tuft、Hillock-like 不进入特征。在少于 50% 样本中出现的模块去掉 150 个，剩下 480 个特征。样本是 578 个批量 RNA 和 181 个单细胞。批量年龄小于 20 或大于 79 的去掉。GTEx 年龄用十年中点。XGBoost 2.1.0，5 折 80/20，种子 1 到 10。 |
| 代码实际算 | `TsankovLab/sc_Aging_clock` 的 `save_residuals_and_predictions` 把残差写成 `y_test - predictions`。仓库里没有保存好的 booster，所以不能从新的模块分数出预测。本技能只在用户已经给出预测年龄时算这个残差。 |
| 同名的另一套 | `teresho4/scRNA-seq_atlas_Hs_PBMC_aging` 是外周血单个核细胞图谱，不是肺实质时钟。仓库 README 也另指向一个 PBMC Synapse 数据集，那是对照数据，不是这个残差公式。 |
