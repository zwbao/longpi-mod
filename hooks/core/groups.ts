// Which group an indicator is shown under on the 指标 tab: blood lipids,
// glucose, inflammation, the blood count, liver, kidney, thyroid, the body
// and blood pressure, and the wearable's series. This is filing, not medical
// data: LOINC codes for the common tests (those of the biological-variation
// table and Mirobody's rows among them); a code that is not listed falls back
// to words in its name, then to 其他. A missing code only files a row by name.

import { foldName } from './units.ts'

export const GROUP_KEYS = ['lipids', 'glucose', 'inflammation', 'blood', 'liver', 'kidney', 'thyroid', 'body', 'wearable', 'other'] as const
export type GroupKey = (typeof GROUP_KEYS)[number]

export const GROUP_ZH: Record<GroupKey, string> = {
  lipids: '血脂',
  glucose: '血糖',
  inflammation: '炎症',
  blood: '血常规',
  liver: '肝功能',
  kidney: '肾功能',
  thyroid: '甲状腺',
  body: '体格与血压',
  wearable: '手环与设备',
  other: '其他',
}

const CODES: Record<Exclude<GroupKey, 'wearable' | 'other'>, string[]> = {
  // Total, LDL, HDL and non-HDL cholesterol, triglycerides, apolipoprotein A1 and B, lipoprotein(a).
  lipids: ['2093-3', '14647-2', '13457-7', '18262-6', '2089-1', '39469-2', '22748-8', '2085-9', '14646-4', '43396-1', '2571-8', '14927-8', '1884-6', '1869-7', '10835-7', '43583-4'],
  // Glucose (fasting and not), HbA1c, insulin.
  glucose: ['14771-0', '1558-6', '2345-7', '14749-6', '2339-0', '15074-8', '4548-4', '17856-6', '59261-8', '20448-7'],
  // hs-CRP, CRP.
  inflammation: ['30522-7', '1988-5'],
  // The blood count: white and red cells, haemoglobin, haematocrit, red-cell indices, platelets, differential.
  blood: [
    '6690-2', '26464-8', '789-8', '26453-1', '718-7', '4544-3', '20570-8', '787-2', '785-6', '786-4', '788-0', '21000-5', '777-3', '26515-7',
    '736-9', '26478-8', '731-0', '26474-7', '770-8', '26511-6', '751-8', '26499-4', '5905-5', '742-7', '713-8', '711-2', '706-2', '704-7', '32623-1',
  ],
  // ALT, AST, GGT, ALP, bilirubin (total, direct, indirect), albumin, total protein, globulin.
  liver: ['1742-6', '1743-4', '1920-8', '2324-2', '6768-6', '1975-2', '1968-7', '1971-1', '1751-7', '2862-1', '2885-2', '10834-0'],
  // Creatinine, urea and urea nitrogen, uric acid, eGFR, cystatin C.
  kidney: ['2160-0', '14682-9', '3094-0', '14937-7', '3091-6', '22664-7', '3084-1', '14933-6', '33914-3', '48642-3', '48643-1', '62238-1', '98979-8', '33863-2'],
  // TSH, total and free T3 and T4.
  thyroid: ['3016-3', '11580-8', '3053-6', '3026-2', '3051-0', '3024-7', '14920-3'],
  // Weight, height, BMI, waist, blood pressure, heart rate.
  body: ['29463-7', '3141-9', '8302-2', '3137-7', '39156-5', '8280-0', '8480-6', '8462-4', '8867-4'],
}

const BY_CODE = new Map<string, GroupKey>(
  (Object.entries(CODES) as Array<[GroupKey, string[]]>).flatMap(([group, codes]) => codes.map((code) => [code, group] as [string, GroupKey])),
)

// Words in a report's name, tried in this order. Urea and uric acid are blood tests; any other name with 尿 is a urine test.
const WORDS: Array<[GroupKey, RegExp]> = [
  ['kidney', /尿素|尿酸|肌酐|肾小球|胱抑素|creatinine|urea|uric|egfr|cystatin/i],
  ['other', /尿|urine/i],
  ['lipids', /胆固醇|甘油三酯|载脂蛋白|脂蛋白|cholesterol|triglyceride|apolipoprotein|lipoprotein|ldl|hdl/i],
  ['glucose', /血糖|葡萄糖|糖化|胰岛素|glucose|hba1c|a1c|insulin/i],
  ['inflammation', /c反应蛋白|crp|c-reactive/i],
  ['thyroid', /甲状腺|促甲状腺|游离t3|游离t4|tsh|thyro|\bft3\b|\bft4\b/i],
  ['liver', /转氨酶|谷丙|谷草|胆红素|白蛋白|球蛋白|总蛋白|碱性磷酸酶|谷氨酰|\balt\b|\bast\b|\bggt\b|\balp\b|bilirubin|albumin|protein/i],
  ['blood', /红细胞|白细胞|血小板|血红蛋白|淋巴|中性粒|单核|嗜酸|嗜碱|细胞压积|hemoglobin|haemoglobin|platelet|lymphocyte|neutrophil|monocyte|eosinophil|basophil|\bwbc\b|\brbc\b|\bmcv\b|\bmch\b|\bmchc\b|\brdw\b|\bplt\b/i],
  ['body', /体重|身高|体质指数|腰围|血压|收缩压|舒张压|心率|脉搏|weight|height|\bbmi\b|waist|blood pressure|systolic|diastolic|heart rate|pulse/i],
]

/** The group of a checkup row, by LOINC code, then by words in its names, then 其他. */
export function groupOf(row: { loinc?: string; name?: string; label?: string }): GroupKey {
  const byCode = row.loinc ? BY_CODE.get(row.loinc.trim()) : undefined
  if (byCode) return byCode
  const text = [row.label, row.name].filter(Boolean).join(' ')
  const folded = foldName(text)
  for (const [group, words] of WORDS) if (words.test(text) || words.test(folded)) return group
  return 'other'
}
