"""Rivagorda et al., Nature Aging 2025, doi:10.1038/s43587-024-00791-0.

Axis proteins are named in the results. About 75% of primary hippocampal neurons
showed GPR158 at the primary cilium. That percentage is a culture count, not a personal score.
Proteomics code is on Dryad. No coefficient from cilium length or osteocalcin to cognition is printed.
"""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

TITLE = "# 海马神经元的纤毛与自噬"

NEURON_PC_PERCENT = 75
WEIGHTS_PRESENT = False

PROTEINS = (
    {
        "display": "骨钙素（osteocalcin）",
        "note": "血源性因子。论文用它在小鼠海马里带动自噬。",
        "aliases": ("骨钙素", "osteocalcin", "ocn"),
    },
    {
        "display": "GPR158",
        "note": "骨钙素在海马神经元上的受体，可以位于初级纤毛。",
        "aliases": ("gpr158",),
    },
    {
        "display": "IFT20",
        "note": "初级纤毛核心蛋白。下调后，骨钙素带动自噬的读出减弱。",
        "aliases": ("ift20",),
    },
    {
        "display": "IFT88",
        "note": "初级纤毛核心蛋白。",
        "aliases": ("ift88",),
    },
    {
        "display": "KIF3A",
        "note": "驱动纤毛运输的驱动蛋白。",
        "aliases": ("kif3a",),
    },
    {
        "display": "TULP3",
        "note": "与 GPR158 共定位，参与受体向纤毛的运输。",
        "aliases": ("tulp3",),
    },
    {
        "display": "ACIII",
        "note": "神经元纤毛膜上的腺苷酸环化酶，用来标出纤毛。",
        "aliases": ("aciii", "ac3", "adcy3"),
    },
    {
        "display": "LC3B",
        "note": "论文用来读出自噬体的蛋白。",
        "aliases": ("lc3b", "map1lc3b"),
    },
)
