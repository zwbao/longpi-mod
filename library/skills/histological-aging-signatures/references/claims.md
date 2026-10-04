# 论文、仓库、另一套同名东西

Nature Medicine（2026），doi:10.1038/s41591-026-04566-5。全文用 pypdf 从 PDF 抽出。25,712 张切片、40 种组织、983 人。

| | 内容 |
| --- | --- |
| 论文声称 | 组织时钟用形态特征回归实足年龄。年龄差是预测年龄减去已知实足年龄（Fig. 1d 正文）。全部组织平均 MAE 4.88 年，决定系数 0.69（Extended Data Fig. 2 与 Supplementary Table 2）。40 个时钟里有 4 个样本少于 100，被写成功效不足。端粒长度用了 6,197 个样本（25.2%）。 |
| 代码实际算 | `rendeirolab/tissue-clocks` 是这篇的分析源码，训练和时钟步骤在 `just clocks`。浅克隆里没有拟合好的切片权重，权重在 Zenodo。本技能不从全切片图像重算年龄。 |
| 同名的另一套 | `WJPina/HUSI` 是人通用衰老指数，用单类逻辑回归和 Spearman 相关给转录组打分，不是组织切片时钟。`bioptimus/releases`、`lazyslide`、`wsi` 是基础模型和切片工具，不是年龄差公式。 |
