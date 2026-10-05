// Did the filing miss anything on the report? The report's own text (macOS PDFKit, tools/pdf_text.js) is read
// for its exam sections (彩超, CT, X线, 心电图, 眼底…) and its lab rows (a name, a value, and a unit or a range), and
// each is matched against what is now on file for that date. What is not matched goes back to the model to file,
// so completeness no longer rests on the model reading every page. A scan (no text layer) is not checked.

/** CJK Radicals Supplement letters some PDF generators use in place of the ordinary characters (⻅ for 见). */
const SUPPLEMENT: Record<string, string> = Object.fromEntries([...'⻅⻓⻔⻢⻜⻆⻝⻛⻋⻩⻉⻚⻥⻮⻬⻦⻘⻣⻤⻨⻰⻳'].map((c, i) => [c, '见长门马飞角食风车黄贝页鱼齿齐鸟青骨鬼麦龙龟'[i] as string]))

export function normalizeText(text: string): string {
  return [...text.normalize('NFKC')].map((c) => SUPPLEMENT[c] ?? c).join('')
}

const EXAM = /^([一-鿿]{0,6}?(?:彩超|B超|超声|低剂量CT|CT|X线|胸片|DR|心电图|眼底镜检查|眼底|骨密度|胃镜|肠镜|核磁|MRI|钼靶|呼气试验|动脉硬化检测|肺功能))/
const UNITS = /(mmol\/L|μmol\/L|umol\/L|g\/L|mg\/L|U\/L|IU\/L|fL|pg|%|mmHg|cm|kg|ng\/mL|pg\/mL|mIU\/L|uIU\/mL|μIU\/mL|pmol\/L|10\^?\d+\/L|10[~*]\d+\/L|×10|\/HP|\/μL|\/uL|mm\/h|次\/分)/i
const STOP = /检查项目|项目名称|单位|参考|结果|提示|页|体检号|用户ID|报告|检查者|初步意见|小结|注[:：]|电话|热线|咨询|地址|日期|姓名|性别|年龄|科室|医师|签名|分院|门诊部|专线|MEDICAL|合计|共\d/
const LAB = /^([一-鿿][一-鿿A-Za-z0-9（）()\-·]{1,18}?)\s+(?:[A-Za-z][A-Za-z0-9\-%#]{0,10}\s+)?([<>≤≥]?\d+(?:\.\d+)?|阴性|阳性|弱阳性|\d\+)/

/** Two-character item names that are real items rather than a wrapped cell's tail. */
const SHORT_NAMES = /^(身高|体重|腰围|臀围|脉搏|心率|尿糖|尿素|肌酐|血糖|尿酸|酮体|隐血|血压|视力|眼压)$/

export type Coverage = { exams: string[]; labs: string[] }

/** What the report's text holds: its exam sections and its lab rows, by name. */
export function reportItems(text: string): Coverage {
  const exams = new Set<string>()
  const labs = new Set<string>()
  for (const raw of text.split('\n')) {
    const line = normalizeText(raw).trim()
    if (!line || STOP.test(line)) continue
    const exam = EXAM.exec(line.replace(/\s+/g, ''))
    // A section heading, not advice that names an exam ("12 个月后复查低剂量CT").
    if (exam && line.length <= 24 && !/复查|建议|随访|后|前|定期|每年/.test(exam[1] as string)) {
      exams.add(exam[1] as string)
      continue
    }
    const lab = LAB.exec(line)
    const name = lab?.[1] ?? ''
    const balanced = (name.match(/[（(]/g) ?? []).length === (name.match(/[）)]/g) ?? []).length
    const plausible = balanced && (name.length >= 3 || SHORT_NAMES.test(name))
    if (lab && plausible && (UNITS.test(line) || /\d\s*[-—~]\s*\d/.test(line) || /阴性|阳性|^\d\+$/.test(lab[2] ?? ''))) labs.add(name)
  }
  return { exams: [...exams], labs: [...labs] }
}

function fold(name: string): string {
  return normalizeText(name).replace(/[\s（）()\-·:：]|[A-Za-z]{2,}/g, '')
}

/** The report's items with nothing on file for them (by name, either containing the other). */
export function notFiled(items: Coverage, filedNames: readonly string[]): Coverage {
  const filed = filedNames.map(fold).filter((name) => name.length >= 2)
  const covered = (name: string) => {
    const f = fold(name)
    return f.length >= 2 && filed.some((x) => x.includes(f) || f.includes(x))
  }
  return { exams: items.exams.filter((name) => !covered(name)), labs: items.labs.filter((name) => !covered(name)) }
}
