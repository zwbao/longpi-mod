"""Numbers and names taken from Santiago-Fernández et al., Nature Metabolism 2025.

The CMA score uses a weight of 1 or 2 and a direction of +1 or -1 (Methods,
Quantitative real-time PCR, citing reference 13). Supplementary Fig. 1 names
the network genes. It does not give a weight column.
"""

DOI = "10.1038/s42255-025-01412-9"
TITLE = "骨骼肌分子伴侣自噬"
FULL_TEXT_READ = True
# Extended Data Fig. 9: male donors in the GESTALT mRNA CMA score.
GESTALT_MALE_MRNA_N = 49
BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Supplementary Fig. 1 heatmap. Order is the printed gene list, not a weight.
NETWORK_GENES = (
    "Lamp2a",
    "Hspa8",
    "Hsp90aa1",
    "Hsp90ab1",
    "Dnajb1",
    "Eef1a1",
    "Phlpp1",
    "Rac1",
    "Nfatc1",
    "Ncor1",
    "Nfe2l2",
    "Rab11a",
    "Rara",
    "Rictor",
    "Akt1",
    "Akt2",
    "Ctsa",
)
# Protein names in the human results (Extended Data Fig. 9–10), not weights.
HUMAN_PROTEINS = (
    "HSC70",
    "EEF1A1",
    "HSP90",
    "AKT1",
    "AKT2",
    "LAMP2A",
    "LAMP2",
    "LAMP1",
    "NFE2L2",
    "NCOR",
    "RAR",
)
