# 论文、代码、另一套同名东西

Lu 等，Nature Aging 6:1138–1157（2026），doi:10.1038/s43587-026-01123-0。全文由本地 PDF 抽出，36 页。

| | 内容 |
| --- | --- |
| 论文声称 | GNPC 血浆 3,289 人。APOE2 携带者（12 个 ε2/ε2，321 个 ε2/ε3）相对 ε3/ε3（1,679 人），Model type 1 有 192 个蛋白显著改变。上调最强的是 UNG、VPS29、BIRC2，下调最明显的是 BCDIN3D 和 S100A13。APOE4 有 357 个蛋白显著改变，例子包括 SPC25、LRRN1、S100A13、TBCA 和 NEFL。FDR 由 Benjamini–Hochberg 校正，阈值 0.05，见 `analysis/src.R`。其中 140/192（73%）在认知未受损者中已经显著，相关系数 r = 0.874。 |
| 这份 Skill 实际算 | 只在用户点名且落在对应 192 或 357 个蛋白里的符号上，按仓库 CSV 的 standardized_beta 绝对值排序。 |
| 代码实际算 | `Lina0125/APOE_proteomics` 的结果文件 `results/GNPC/e2vse3e3/apoe2protein.csv` 与 `e4vse3e3/apoe2protein.csv`。UK Biobank Olink 表是另一组织，ε2 显著 41 个、ε4 显著 10 个，不放进默认名单。 |
| 同名的另一套 | GNPC 是联盟数据本身。UKB Olink 的 APOE 对比不是 GNPC 的 SomaLogic 7K Model type 1。 |
