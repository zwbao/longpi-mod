"""Hospital Frailty Risk Score weights from Supplementary Table 18.

doi:10.1038/s43587-025-00925-y. Each code is counted once.
"""

from __future__ import annotations

BOUNDARY = "这是研究复现意义上的个人读出，不是治疗建议。不能据此开始或停止任何药物。名单里没有某个名字，不是停用的理由。体检不增删方法算出的名单。"

N_ICD10 = 109
WEIGHT_MIN = 0.1
WEIGHT_MAX = 7.1
LOW_BELOW = 5.0
HIGH_ABOVE = 15.0
ICD_FROM_AGE = 30
WEIGHTS_PRESENT = True
DEMENTIA_CODES = frozenset({"F00", "F01", "F03", "G30"})
HFRS_ITEMS = (
    ('F00', 7.1, '阿尔茨海默病所致痴呆', 'Dementia in Alzheimer’s disease'),
    ('G81', 4.4, '偏瘫', 'Hemiplegia'),
    ('G30', 4.0, '阿尔茨海默病', 'Alzheimer’s disease'),
    ('I69', 3.7, '脑血管病后遗症', 'Sequelae of cerebrovascular disease'),
    ('R29', 3.6, '神经和肌肉骨骼系统的其他症状和体征', 'Other symptoms and signs involving the nervous and musculoskeletal systems'),
    ('N39', 3.2, '泌尿系统其他疾患', 'Other disorders of urinary system (includes urinary tract infection and urinary incontinence)'),
    ('F05', 3.2, '谵妄', 'Delirium, not induced by alcohol and other psychoactive substances'),
    ('W19', 3.2, '未特指的跌倒', 'Unspecified fall'),
    ('S00', 3.2, '头部浅表损伤', 'Superficial injury of head'),
    ('R31', 3.0, '未特指的血尿', 'Unspecified haematuria'),
    ('B96', 2.9, '其他细菌病原体', 'Other bacterial agents as the cause of diseases classified to other chapters'),
    ('R41', 2.7, '认知和意识的其他症状和体征', 'Other symptoms and signs involving cognitive functions and awareness'),
    ('R26', 2.6, '步态和移动异常', 'Abnormalities of gait and mobility'),
    ('I67', 2.6, '其他脑血管病', 'Other cerebrovascular diseases'),
    ('R56', 2.6, '惊厥', 'Convulsions, not elsewhere classified'),
    ('R40', 2.5, '嗜睡、木僵和昏迷', 'Somnolence, stupor and coma'),
    ('T83', 2.4, '泌尿生殖假体装置的并发症', 'Complications of genitourinary prosthetic devices, implants and grafts'),
    ('S06', 2.4, '颅内损伤', 'Intracranial injury'),
    ('S42', 2.3, '肩和上臂骨折', 'Fracture of shoulder and upper arm'),
    ('E87', 2.3, '水电解质和酸碱平衡的其他疾患', 'Other disorders of fluid, electrolyte and acid-base balance'),
    ('M25', 2.3, '其他关节疾患', 'Other joint disorders, not elsewhere classified'),
    ('E86', 2.3, '血容量不足', 'Volume depletion'),
    ('R54', 2.2, '衰老', 'Senility'),
    ('Z51', 2.1, '康复操作', 'Care involving use of rehabilitation procedures'),
    ('F03', 2.1, '未特指的痴呆', 'Unspecified dementia'),
    ('W18', 2.1, '同一平面的其他跌倒', 'Other fall on same level'),
    ('Z75', 2.0, '与医疗设施和其他卫生保健有关的问题', 'Problems related to medical facilities and other health care'),
    ('F01', 2.0, '血管性痴呆', 'Vascular dementia'),
    ('S80', 2.0, '小腿浅表损伤', 'Superficial injury of lower leg'),
    ('L03', 2.0, '蜂窝织炎', 'Cellulitis'),
    ('H54', 1.9, '盲和视力低下', 'Blindness and low vision'),
    ('E53', 1.9, '其他B族维生素缺乏', 'Deficiency of other B group vitamins'),
    ('Z60', 1.8, '与社会环境有关的问题', 'Problems related to social environment'),
    ('G20', 1.8, '帕金森病', 'Parkinson’s disease'),
    ('R55', 1.8, '晕厥和虚脱', 'Syncope and collapse'),
    ('S22', 1.8, '肋骨、胸骨和胸椎骨折', 'Fracture of rib(s), sternum and thoracic spine'),
    ('K59', 1.8, '其他功能性肠疾患', 'Other functional intestinal disorders'),
    ('N17', 1.8, '急性肾衰竭', 'Acute renal failure'),
    ('L89', 1.7, '褥疮', 'Decubitus ulcer'),
    ('Z22', 1.7, '传染病病原携带者', 'Carrier of infectious disease'),
    ('B95', 1.7, '链球菌和葡萄球菌病原体', 'Streptococcus and staphylococcus as the cause of diseases classified to other chapters'),
    ('L97', 1.6, '下肢溃疡', 'Ulcer of lower limb, not elsewhere classified'),
    ('R44', 1.6, '一般感觉和知觉的其他症状和体征', 'Other symptoms and signs involving general sensations and perceptions'),
    ('K26', 1.6, '十二指肠溃疡', 'Duodenal ulcer'),
    ('I95', 1.6, '低血压', 'Hypotension'),
    ('N19', 1.6, '未特指的肾衰竭', 'Unspecified renal failure'),
    ('A41', 1.6, '其他败血症', 'Other septicaemia'),
    ('Z87', 1.5, '其他疾病和情况的个人史', 'Personal history of other diseases and conditions'),
    ('J96', 1.5, '呼吸衰竭', 'Respiratory failure, not elsewhere classified'),
    ('X59', 1.5, '暴露于未特指因素', 'Exposure to unspecified factor'),
    ('M19', 1.5, '其他关节病', 'Other arthrosis'),
    ('G40', 1.5, '癫痫', 'Epilepsy'),
    ('M81', 1.4, '无病理性骨折的骨质疏松', 'Osteoporosis without pathological fracture'),
    ('S72', 1.4, '股骨骨折', 'Fracture of femur'),
    ('S32', 1.4, '腰椎和骨盆骨折', 'Fracture of lumbar spine and pelvis'),
    ('E16', 1.4, '胰腺内分泌的其他疾患', 'Other disorders of pancreatic internal secretion'),
    ('R94', 1.4, '功能检查异常结果', 'Abnormal results of function studies'),
    ('N18', 1.4, '慢性肾衰竭', 'Chronic renal failure'),
    ('R33', 1.3, '尿潴留', 'Retention of urine'),
    ('R69', 1.3, '未知和未特指的发病原因', 'Unknown and unspecified causes of morbidity'),
    ('N28', 1.3, '肾和输尿管的其他疾患', 'Other disorders of kidney and ureter, not elsewhere classified'),
    ('R32', 1.2, '未特指的尿失禁', 'Unspecified urinary incontinence'),
    ('G31', 1.2, '神经系统其他变性病', 'Other degenerative diseases of nervous system, not elsewhere classified'),
    ('Y95', 1.2, '医源性情况', 'Nosocomial condition'),
    ('S09', 1.2, '头部其他和未特指的损伤', 'Other and unspecified injuries of head'),
    ('R45', 1.2, '涉及情绪状态的症状和体征', 'Symptoms and signs involving emotional state'),
    ('G45', 1.2, '短暂性脑缺血发作和相关综合征', 'Transient cerebral ischaemic attacks and related syndromes'),
    ('Z74', 1.1, '与护理者依赖有关的问题', 'Problems related to care-provider dependency'),
    ('M79', 1.1, '其他软组织疾患', 'Other soft tissue disorders, not elsewhere classified'),
    ('W06', 1.1, '涉及床的跌倒', 'Fall involving bed'),
    ('S01', 1.1, '头部开放性伤口', 'Open wound of head'),
    ('A04', 1.1, '其他细菌性肠道感染', 'Other bacterial intestinal infections'),
    ('A09', 1.1, '推定为感染性的腹泻和胃肠炎', 'Diarrhoea and gastroenteritis of presumed infectious origin'),
    ('J18', 1.1, '未特指病原体的肺炎', 'Pneumonia, organism unspecified'),
    ('J69', 1.0, '固体和液体引起的肺炎', 'Pneumonitis due to solids and liquids'),
    ('R47', 1.0, '言语障碍', 'Speech disturbances, not elsewhere classified'),
    ('E55', 1.0, '维生素D缺乏', 'Vitamin D deficiency'),
    ('Z93', 1.0, '人工造口状态', 'Artificial opening status'),
    ('R02', 1.0, '坏疽', 'Gangrene, not elsewhere classified'),
    ('R63', 0.9, '有关食物和液体摄入的症状和体征', 'Symptoms and signs concerning food and fluid intake'),
    ('H91', 0.9, '其他听力丧失', 'Other hearing loss'),
    ('W10', 0.9, '在楼梯和台阶上的跌倒', 'Fall on and from stairs and steps'),
    ('W01', 0.9, '在同一平面滑倒绊倒和跌倒', 'Fall on same level from slipping, tripping and stumbling'),
    ('E05', 0.9, '甲状腺毒症', 'Thyrotoxicosis [hyperthyroidism]'),
    ('M41', 0.9, '脊柱侧凸', 'Scoliosis'),
    ('R13', 0.8, '吞咽困难', 'Dysphagia'),
    ('Z99', 0.8, '对辅助机器和装置的依赖', 'Dependence on enabling machines and devices'),
    ('U80', 0.8, '耐青霉素及相关抗生素的病原体', 'Agent resistant to penicillin and related antibiotics'),
    ('M80', 0.8, '伴病理性骨折的骨质疏松', 'Osteoporosis with pathological fracture'),
    ('K92', 0.8, '消化系统其他疾病', 'Other diseases of digestive system'),
    ('I63', 0.8, '脑梗死', 'Cerebral Infarction'),
    ('N20', 0.7, '肾和输尿管结石', 'Calculus of kidney and ureter'),
    ('F10', 0.7, '使用酒精引起的精神和行为障碍', 'Mental and behavioural disorders due to use of alcohol'),
    ('Y84', 0.7, '其他医疗操作作为患者异常反应的原因', 'Other medical procedures as the cause of abnormal reaction of the patient'),
    ('R00', 0.7, '心搏异常', 'Abnormalities of heart beat'),
    ('J22', 0.7, '未特指的急性下呼吸道感染', 'Unspecified acute lower respiratory infection'),
    ('Z73', 0.6, '与生活管理困难有关的问题', 'Problems related to life-management difficulty'),
    ('R79', 0.6, '血液化学的其他异常所见', 'Other abnormal findings of blood chemistry'),
    ('Z91', 0.5, '危险因素的个人史', 'Personal history of risk-factors, not elsewhere classified'),
    ('S51', 0.5, '前臂开放性伤口', 'Open wound of forearm'),
    ('F32', 0.5, '抑郁发作', 'Depressive episode'),
    ('M48', 0.5, '椎管狭窄', 'Spinal stenosis (secondary code only)'),
    ('E83', 0.4, '矿物质代谢疾患', 'Disorders of mineral metabolism'),
    ('M15', 0.4, '多关节病', 'Polyarthrosis'),
    ('D64', 0.4, '其他贫血', 'Other anaemias'),
    ('L08', 0.4, '皮肤和皮下组织的其他局部感染', 'Other local infections of skin and subcutaneous tissue'),
    ('R11', 0.3, '恶心和呕吐', 'Nausea and vomiting'),
    ('K52', 0.3, '其他非感染性胃肠炎和结肠炎', 'Other noninfective gastroenteritis and colitis'),
    ('R50', 0.1, '原因不明的发热', 'Fever of unknown origin'),
)


def hfrs_bin(score: float) -> str:
    if score < LOW_BELOW:
        return "低"
    if score <= HIGH_ABOVE:
        return "中间"
    return "高"


def _compact(text: str) -> str:
    raw = str(text).upper().replace("\u00a0", " ")
    return "".join(ch for ch in raw if ch.isalnum())


_BY_CODE = {code: (weight, zh) for code, weight, zh, _desc in HFRS_ITEMS}
_BY_NAME = {}
for code, weight, zh, desc in HFRS_ITEMS:
    _BY_NAME[zh.casefold()] = code
    _BY_NAME[desc.casefold()] = code


def match_condition(name: str) -> tuple[str, float, str] | None:
    folded = " ".join(str(name).replace("\u00a0", " ").split()).casefold()
    if folded in _BY_NAME:
        code = _BY_NAME[folded]
        weight, zh = _BY_CODE[code]
        return code, weight, zh
    token = _compact(name)
    if len(token) < 3:
        return None
    hits = [code for code in _BY_CODE if token.startswith(code) and len(token) >= len(code)]
    if not hits:
        return None
    code = max(hits, key=len)
    weight, zh = _BY_CODE[code]
    return code, weight, zh

