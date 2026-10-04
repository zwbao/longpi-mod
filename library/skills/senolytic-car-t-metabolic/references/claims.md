# 论文、补充表、仓库、另一套同名东西

Amor 等，Nature Aging（2024），doi:10.1038/s43587-023-00560-5。正文用 pypdf 读本地 PDF。Source Data Fig. 6 的 xlsx 已下载。代码仓库根目录和 Amor_helper.R 已打开。

| 论文声称什么 | 补充表里实际有什么 | 代码仓库实际算什么 | 同名的另一个项目是什么 |
| --- | --- | --- | --- |
| 小鼠静脉输注 0.5×10^6 个 m.uPAR-m.28z CAR 阳性细胞。有差别要求相对未转导细胞和相对 h.19-m.28z 的两个 P 值都小于 0.05，只有一个小于 0.05 则记为趋势、分析不确定。老年鼠糖负荷 2 g/kg，高脂模型 1 g/kg，胰岛素 0.5 U/kg。单细胞数据号是 GSE243616。 | Source Data Fig. 6 的文字格有 Fig.6a、Spleen、UT、h.19-m.28z、m.uPAR-m.28z、Mouse 编号、Time point、0 min、15 min。没有面积系数，没有截距。 | https://github.com/naikai/Amor_et_al_2023/ 的 README 只有仓库名。Amor_helper.R 把基因表送进 enrichR。Adipose、Liver、Pancreas 三个目录在仓库里，这次没有把它们当成个人系数。 | 同一实验室更早的 uPAR CAR T 用来看年轻动物的肝纤维化，不是这篇的老年代谢终点。达沙替尼加槲皮素是另一类衰老细胞清除。 |
