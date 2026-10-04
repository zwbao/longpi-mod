# 论文、仓库、另一套同名东西

Austin、Nethander 等，Nature Aging（2024），doi:10.1038/s43587-024-00639-7。全文用 pypdf 从 PDF 抽出。

| | 内容 |
| --- | --- |
| 论文声称 | 加权蛋白风险分纳入在 CHS 里通过 Bonferroni P < 1.0×10−5 的 18 个 aptamer。权重是 Cox 回归的 β（Supplementary Table 2）。LASSO：500 次 70/30 划分、十折交叉验证，最简模型 22 个蛋白（Supplementary Table 3）。弹性网 α = 0.9，20 个蛋白（Supplementary Table 4）。5K 平台 5,284 个 aptamer、7K 平台 7,596 个，去掉 deprecated 与 non-human 后分析用 4,979 个。分类 NRI 用 3% 的预测髋部骨折阈值。超声 eBMD = 0.0025926 × (BUA + SOS) − 3.687。Table 1：两个 HUNT 合并，每升高 1 个标准差 HR 1.56（1.36–1.79）；限制到 13 个蛋白时合并 HR 1.56（1.35–1.80）。UK Biobank 全部 50,876 人 HR 1.63（1.52–1.76）；随机子集 HR 1.64（1.49–1.80）。三个验证队列 56,123 人、1,028 例，Fig. 2a HR 1.63（1.52–1.74）。摘要里的 FRAX C-index 0.735，FRAX 加蛋白分 0.776。摘要另写 HR 1.64（1.53–1.77），区间和 Table 1 的 1.64（1.49–1.80）不是同一个数。 |
| 代码实际算 | `marianethander/Protein_Risk_Score` 的 `Code/NRI.R`、`IDI.R`、`NRIcutoff.R`、`test2AUC.R` 计算连续 NRI、IDI 和 AUC。仓库没有 18 个蛋白的名字，也没有 Cox β。本技能用的系数来自补充表 S2、S3、S4 的 CHS 列，不是那个仓库。 |
| 同名的另一套 | 摘要里的 FRAX 是临床骨折风险工具，不是这个蛋白分。PRS-Fracture、PRS-FN-BMD、PRS-gSOS 是别的遗传风险分。 |
