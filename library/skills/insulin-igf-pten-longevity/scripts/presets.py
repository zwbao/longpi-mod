"""Park et al., Nature Communications 2021. Allele table is Supplementary Table 1."""

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

# Fig. 3g. Protein tyrosine phosphatase activity of human PTEN C105Y relative to wild type.
C105Y_PROTEIN_PHOSPHATASE_PERCENT = 57.3
# Fig. 3e,f. Recombinant protein concentrations used in the lipid phosphatase assay.
LIPID_ASSAY_NM = (127, 42)

# Supplementary Table 1.
ALLELES = {
    "yh1": ("daf-18", "C150Y"),
    "syb499": ("daf-18", "C150Y"),
    "yh2": ("daf-16", "Q115STOP"),
    "yh3": ("daf-16", "splice_donor"),
}


def fold_variant(text: str) -> str:
    return (
        text.strip()
        .lower()
        .replace(" ", "")
        .replace("-", "")
        .replace("_", "")
        .replace("(", "")
        .replace(")", "")
        .replace(":", "")
    )


def classify(text: str) -> str:
    folded = fold_variant(text)
    if folded in {"c150y", "daf18c150y", "yh1", "daf18yh1", "syb499", "daf18syb499"}:
        return "C150Y"
    if folded in {"c105y", "ptenc105y", "humanptenc105y"}:
        return "C105Y"
    if folded in {"c124s", "ptenc124s"}:
        return "C124S"
    if folded in {"yh2", "daf16yh2", "q115stop"}:
        return "yh2"
    if folded in {"yh3", "daf16yh3"}:
        return "yh3"
    return "other"
