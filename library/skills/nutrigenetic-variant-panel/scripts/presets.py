"""The four diet-related variants kept after reviewing the VitaClaw/ClawBio panel.

Each entry: rsID, the plus-strand reference and effect bases (GRCh38, as
Ensembl REST reports them; consumer files use the same plus strand), the
primary citation, the sentence from it that the reading rests on, and the
plain-Chinese reading for 0, 1 and 2 copies of the effect base. Nothing here is
a dose. Actions are worded 「可以考虑…检查/和医生聊」.

Kept: ALDH2 rs671, MTHFR rs1801133 (C677T), LCT rs4988235 (-13910), and APOE
rs429358 + rs7412 only on request and only for blood lipids. Dropped entries
and why are in references/claims.md.
"""

from __future__ import annotations

DOI = "10.1371/journal.pmed.1000050"

BOUNDARY = (
    "这是按几篇论文对照少数几个基因位点的查表结果，不是诊断，也不是营养处方。"
    "基因型不决定你该吃多少、补多少；检查和调整请和医生聊。"
    "芯片只看这几个位点，没说到的不等于没有影响。"
)

# Plus-strand bases. Frequencies: 1000 Genomes phase 3 via Ensembl REST
# (https://rest.ensembl.org/variation/human/<rsid>?pops=1), read 2026-09-29.
VARIANTS = {
    "aldh2": {
        "rsid": "rs671",
        "gene": "ALDH2",
        "title_zh": "喝酒：ALDH2（rs671）",
        "grch38": "12:111803962 G/A",
        "reference": "G",
        "effect": "A",
        "effect_name": "ALDH2*2（Lys）",
        "eas_effect_frequency": 0.1736,
        "doi": "10.1371/journal.pmed.1000050",
        "cite": "Brooks 等，PLoS Medicine 2009",
        "quote": (
            "case control studies in Japan and Taiwan have consistently demonstrated a strong link between the risk "
            "of esophageal squamous cell carcinoma ( Figure 3 ) and alcohol consumption in low-activity ALDH2 "
            "heterozygotes, with odds ratios (ORs) ranging from 3.7 to 18.1 after adjustment for alcohol consumption."
        ),
        "reading": {
            0: "两份都是正常型 ALDH2。喝酒后的脸红、心慌不是这个位点造成的。这不是说喝酒安全：酒精对每个人都会增加癌症风险。",
            1: (
                "你带一份 ALDH2*2（东亚常见的「喝酒脸红」型）。这种人分解乙醛的能力低很多，喝酒后多半会脸红、心跳快。"
                "日本和台湾的病例对照研究里，这类人喝酒时食管鳞癌的风险比正常型高好几倍到十几倍（比值比 3.7–18.1）。"
                "有的人喝多了以后不再明显难受、成了常喝酒的人，论文指出正是这类人风险最高。"
            ),
            2: (
                "你带两份 ALDH2*2。这种人几乎不能分解乙醛，一般喝一点就很难受，所以多数人喝得很少；"
                "论文指出正因为喝不了多少，这类人没有显出喝酒带来的食管癌风险。不要为了应酬硬喝。"
            ),
        },
        "action": {
            0: "",
            1: "可以考虑不喝或少喝酒。已经长期喝酒的，可以和医生聊要不要做胃镜检查。",
            2: "可以考虑不喝酒，不要为了应酬硬喝。",
        },
    },
    "mthfr": {
        "rsid": "rs1801133",
        "gene": "MTHFR",
        "title_zh": "叶酸代谢：MTHFR C677T（rs1801133）",
        "grch38": "1:11796321 G/A（G 对应 677C，A 对应 677T）",
        "reference": "G",
        "effect": "A",
        "effect_name": "677T",
        "eas_effect_frequency": 0.2956,
        "doi": "10.1038/ng0595-111",
        "cite": "Frosst 等，Nature Genetics 1995",
        "quote": (
            "The mutation in the heterozygous or homozygous state correlates with reduced enzyme activity and increased "
            "thermolability in lymphocyte extracts; ... Finally, individuals homozygous for the mutation have "
            "significantly elevated plasma homocysteine levels."
        ),
        "reading": {
            0: "两份都是 677C（常见型）。",
            1: "你带一份 677T。这篇论文里一份 677T 的人酶活性偏低，但血同型半胱氨酸明显升高的是两份 677T 的人。",
            2: "你带两份 677T（常说的 TT 型）。这篇论文里 TT 的人血同型半胱氨酸明显更高。",
        },
        "action": {
            0: "",
            1: "",
            2: "可以考虑查一次血同型半胱氨酸；结果偏高时再和医生聊原因和饮食。不要只凭这个基因型自己加吃补剂，补不补、补什么，由医生看化验结果再说。",
        },
        "caveat": (
            "美国医学遗传学与基因组学学会（ACMG，2013）认为 MTHFR 基因检测的临床用处很小，"
            "不应作为血栓倾向的常规检查。所以这里只提示可以查血里的同型半胱氨酸本身。"
        ),
        "caveat_doi": "10.1038/gim.2012.165",
    },
    "lct": {
        "rsid": "rs4988235",
        "gene": "LCT（MCM6）",
        "title_zh": "喝奶：乳糖酶（LCT -13910，rs4988235）",
        "grch38": "2:135851076 G/A（G 对应 -13910C，A 对应 -13910T）",
        "reference": "G",
        "effect": "A",
        "effect_name": "-13910T（成年后乳糖酶仍持续）",
        "eas_effect_frequency": 0.0,
        "doi": "10.1038/ng826",
        "cite": "Enattah 等，Nature Genetics 2002",
        "quote": (
            "a DNA variant, C/T-13910, roughly 14 kb upstream from the LCT locus, completely associates with "
            "biochemically verified lactase non-persistence in Finnish families and a sample set of 236 individuals "
            "from four different populations."
        ),
        "reading": {
            0: (
                "两份都是 -13910C。按这个位点，成年后小肠乳糖酶多半不再持续。"
                "这在中国人里几乎人人如此（1000 基因组东亚样本里没有见到 -13910T），所以这个结果本身说明不了多少；"
                "它区分不了中国人里谁耐受乳糖、谁不耐受，喝奶后的感受更说明问题。"
            ),
            1: "你带一份 -13910T，按这个位点成年后乳糖酶多半仍然持续。",
            2: "你带两份 -13910T，按这个位点成年后乳糖酶多半仍然持续。",
        },
        "action": {
            0: "喝奶后腹胀、腹泻的，可以考虑少量多次、和饭一起喝，或者选酸奶、低乳糖奶。症状重或伴体重下降、便血时和医生聊。",
            1: "",
            2: "",
        },
    },
}

# APOE: only with --apoe, and only the blood-lipid reading.
APOE = {
    "sites": {"rs429358": ("T", "C"), "rs7412": ("C", "T")},
    "grch38": "19:44908684 T/C（rs429358），19:44908822 C/T（rs7412）",
    "doi": "10.1001/jama.298.11.1300",
    "cite": "Bennet 等，JAMA 2007",
    "quote": (
        "There were approximately linear relationships of apoE genotypes (when ordered epsilon2/epsilon2, "
        "epsilon2/epsilon3, epsilon2/epsilon4, epsilon3/epsilon3, epsilon3/epsilon4, epsilon4/epsilon4) with LDL-C "
        "and with coronary risk."
    ),
    # (C count at rs429358, T count at rs7412) -> genotype
    "genotypes": {
        (0, 0): "ε3/ε3",
        (0, 1): "ε2/ε3",
        (0, 2): "ε2/ε2",
        (1, 0): "ε3/ε4",
        (2, 0): "ε4/ε4",
        (1, 1): "ε2/ε4",
    },
    "lipid_order": ["ε2/ε2", "ε2/ε3", "ε2/ε4", "ε3/ε3", "ε3/ε4", "ε4/ε4"],
    "action": "可以考虑查一次血脂（重点看低密度脂蛋白胆固醇），按血脂结果和医生聊饮食和要不要处理。",
    "not_interpreted": (
        "APOE 还和其他疾病（包括老年痴呆）的风险有关。这份饮食报告不解读那一部分。"
        "想了解的话，先和医生或遗传咨询师聊，再决定要不要看。"
    ),
    "counselling_doi": "10.1097/GIM.0b013e31821d69b8",
}

NOT_INCLUDED = (
    "VitaClaw 原来的 28 个位点里，咖啡因代谢（CYP1A2、AHR）、维生素 D 受体、Omega-3（FADS1/2、ELOVL2）、"
    "胡萝卜素转化（BCMO1）、抗氧化（SOD2、GPX1、NQO1、COMT）、体重和血糖（FTO、TCF7L2、PPARG）等位点没有放进来："
    "有的研究结果不一致，有的效应很小，都不能据此给出饮食建议。"
    "乙醇脱氢酶（ADH1B）也影响喝酒的风险，但它能给的建议和 ALDH2 一样（少喝酒），这里不单列。"
)
