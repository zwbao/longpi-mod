# 论文、补充表、仓库、另一个项目

Li 等，Science Advances（2026），doi:10.1126/sciadv.aed1961。PMC：PMC13580549。已打开期刊补充 PDF `sciadv.aed1961_sm.pdf`（EuropePMC supplementaryFiles；Figs. S1–S12，Tables S1–S7）。scRNA-seq：ArrayExpress E-MTAB-17006。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 衰老血管内皮中 C/EBPβ/AEP 通路进行性激活，推动血管退化与寿命缩短。内皮特异过表达 C/EBPβ 或 AEP 加速血管衰老并缩短小鼠寿命。AEP 在 N136 切割 NAMPT，导致系统性 NAD+ 耗竭与衰老表型。AEP 敲除或 AEP 抗性 NAMPT N136A、以及 AEP 抑制剂 CP#11A 或 NMN 补充，在 Tie2-C/EBPβ 转基因小鼠中缓解血管衰老；文中写 CP#11A 优于单独 NMN。人骨骼肌与大脑皮层内皮随年龄可见 C/EBPβ/AEP 升高（Fig. 1；Table S6 为人尸检样本特征）。 | Table S1–S2：小鼠衰弱指数评分项。Table S3–S5：CP#11A 处理后小鼠血常规/生化/尿检均值，不是个人权重。Table S6：人样本年龄性别。Table S7：抗体、引物、质粒（含 GST-NAMPT N136A）与试剂。没有个人 NAD+、血管年龄或用药剂量的系数列。 | 数据可用性写结论所需数据与代码在正文/补充材料中；未给出独立 GitHub。scRNA-seq 在 ArrayExpress。本技能不跑 ArrayExpress，只按正文与已打开补充表列通路与边界。 | `sirt1-hepatocyte-nampt` 拆的是肝细胞 NAMPT 与肝细胞 SIRT1。本篇是内皮 C/EBPβ/AEP 切割 NAMPT。`trigonelline-nad-precursor-muscle` 与 `circadian-nad-meibomian-aging` 是其他 NAD 相关技能，方法不同。 |
