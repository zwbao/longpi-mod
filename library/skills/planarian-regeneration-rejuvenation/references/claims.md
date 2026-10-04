# 论文、补充表、仓库、另一套同名东西

Dai 等，Nature Aging（2025），doi:10.1038/s43587-025-00847-9。正文前二十页和后面的方法已读。`43587_2025_847_MOESM4_ESM.xlsx` 已打开。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 方法写过滤后保留 104,617 个细胞。图 1b 抽了 744 只个体看异位眼。图 3b 里年轻 LAF 的平均孵化比例是 59%，年老队列约 6%，再生后回到 58%。PAG 的阈值是绝对 log2FC 大于 0.25 且校正 P 值小于 0.05。相对头大小定义为头部面积除以全身面积。生育力定义为孵化卵囊除以卵囊总数。edgeR 模型是 log(expression) ~ log(age)。SOSd 和 ndk 随年龄下降并被再生扳回；COX1/COX2 和 Hspa8 在神经和肌肉上升并被扳回；Smed-inr-1 在肠道下降并回升。活性氧随年龄升高并被再生扳回。测序数据在 BioProject PRJNA974485。 | PAG 在 Supplementary Table 7，与哺乳动物的平行比较在 Supplementary Table 8，基因集比较在 Supplementary Table 9，体型匹配在 Supplementary Table 11，细胞周期标记在 Supplementary Table 12，SOSd、UBAC1、CA10 的序列在 Supplementary Table 14。另已打开年龄相关基因表，列是 versus、tissue、p_value、p_val_adj、avg_log2FC、gene，gene 是涡虫编号。文件里标成 Supplementary Table 7 的是 GO 术语，不是 log2FC。标成 Supplementary Table 8 的列是 NES 和 P 值。未点名的人基因不按这些列分类。 | 代码可用性写测序分析没有自定义代码。应激运动实验指向 https://github.com/PletcherLab/Arena_R_Code/tree/main/Code/ 。该目录是 DDrop 一类的活动追踪脚本，不是 PAG 的 log2FC 表。 | 文中重分析的无性涡虫细胞图谱，以及用来比较的哺乳动物衰老和延寿干预签名，不是这套性成熟涡虫的 PAG 名单。 |
