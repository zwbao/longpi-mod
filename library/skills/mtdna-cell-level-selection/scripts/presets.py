"""Kotrys et al., Nature 2024, doi:10.1038/s41586-024-07332-0.

Thresholds are the ones printed for their 293T experiments.
"""

BOUNDARY = (
    "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。"
    "名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"
)

TITLE = "细胞水平的线粒体选择"
DOI = "10.1038/s41586-024-07332-0"
FULL_TEXT_READ = True

# Barnyard experiment, mean reads per cell. Not printed in the personal report.
MEAN_READS_PER_CELL = 3620

MISSENSE = "m.11696G>A"
SILENT = "m.11698C>T"
MODEL_PERCENT = 56
DROPOUT_PERCENT = 60
UMI_MIN = 64

ENVIRONMENTS = {
    "galactose": "半乳糖作为唯一糖源时，正文写氧化磷酸化有缺陷的细胞适合度下降。",
    "半乳糖": "半乳糖作为唯一糖源时，正文写氧化磷酸化有缺陷的细胞适合度下降。",
    "glucose": "葡萄糖是这篇实验的糖源对照。正文没有给它单独的异质性切点。",
    "葡萄糖": "葡萄糖是这篇实验的糖源对照。正文没有给它单独的异质性切点。",
    "hypoxia": "百分之一氧可以缓冲复合体 I 缺陷。",
    "低氧": "百分之一氧可以缓冲复合体 I 缺陷。",
    "normoxia": "百分之二十一氧是常氧对照。",
    "常氧": "百分之二十一氧是常氧对照。",
}
