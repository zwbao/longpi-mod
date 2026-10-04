# 论文、补充表、代码、另一套同名东西

Wu 等，Nature Aging 4:527–545（2024），doi:10.1038/s43587-024-00607-1。全文由本地 PDF 抽出。Supplementary Table 1、2 和 3 已打开。

| 论文声称 | 补充表里实际有 | 代码仓库实际算 | 同名的另一个项目 |
| --- | --- | --- | --- |
| 三个年龄组：年轻 18–28 岁，中年 36–39 岁，年长 47–49 岁。八种细胞：颗粒（GSTA1、AMH、HSD17B1）、卵母（TUBB8、ZP3、FIGLA）、卵泡膜和基质（DCN、STAR）、平滑肌（ACTA2、MUSTN1）、内皮（TM4SF1、VWF）、单核（TYROBP、IFI30）、自然杀伤（CCL5、NKG7）、T 淋巴（IL7R、KLRB1）。CDKN1A 在各细胞类型升高。FOXP1 随年龄下降并抑制 CDKN1A 转录；沉默后小鼠出现早发性卵巢功能不全。颗粒细胞三个亚型，卵泡膜和基质五个亚型，亚型 1 有 STAR 和 CYB5A。差异基因阈值 \|avg_logFC\| > 0.25 且校正 P < 0.05。其中一个对比的基因数在扩展数据里写成 1,068。数据 GSE255690。 | Supplementary Table 1 是供者年龄、AMH、周期和诊断，属于队列，不进个人报告。Supplementary Table 2 三张表的列是 p_val、avg_logFC、pct.1、pct.2、p_val_adj、cluster、gene。没有截距。Supplementary Table 3（43587_2024_607_MOESM4_ESM.xlsx）已打开，24 张对比表，列是 p_val、avg_logFC、pct.1、pct.2、p_val_adj。没有截距，个人报告不据此判定差异基因。 | 论文把分析代码放在 https://zenodo.org/doi/10.5281/zenodo.10867453 。那是单细胞和空间转录组流程，不是个人年龄权重。 | Jin 等的人卵巢单核多组学图谱是另一篇。常见变异绝经年龄研究也不是这八种细胞的标志表。 |
