// Whose record the calculators use. The account holder and the person the labs
// belong to are not always the same (a daughter opening her father's checkups).

import type { Profile, Sex } from './profile.ts'

export interface RecordSubject {
  relationship_zh: string
  age: number | null
  sex: Sex
}

export function calculatorIdentity(profile: Profile): { age: number | null; sex: Sex; subject: boolean } {
  const subject = profile.subject
  if (!subject) return { age: profile.age, sex: profile.sex, subject: false }
  const sex = subject.sex === 'male' || subject.sex === 'female' ? subject.sex : profile.sex
  return { age: subject.age ?? profile.age, sex, subject: true }
}

/** A sentence that the checkup belongs to a parent, with their age when it is stated. */
export function subjectFromText(text: string): RecordSubject | null {
  const raw = String(text ?? '').replace(/\s/g, '')
  const female = /我(?:妈|妈妈|母亲)/.test(raw)
  const male = /我(?:爸|父亲|爹)/.test(raw)
  if (!female && !male) return null
  if (/我自己|我本人/.test(raw) && !/我(?:爸|父亲|爹|妈|妈妈|母亲)/.test(raw)) return null
  const ageMatch = raw.match(/(?:他|她)(?:今年|年纪)?(\d{2})岁/)
  const age = ageMatch ? Number(ageMatch[1]) : null
  if (age != null && (age < 1 || age > 120)) return null
  return { relationship_zh: female && !male ? '母亲' : '父亲', age, sex: female && !male ? 'female' : 'male' }
}

// Labs that only one sex has. A record whose rows contradict the sex of the person the calculators use is not one
// person's record: a daughter's account holding her father's checkups, or two people's reports mixed together.
const MALE_ONLY_LAB = /前列腺特异|前列腺抗原|\b[ft]?PSA\b/i
const FEMALE_ONLY_LAB = /宫颈|阴道|白带/

/**
 * Why this record cannot be treated as one person's for a body-age number, or null when it can. The reference is
 * the account holder, unless the profile says the labs are a relative's and gives that relative's age: then the
 * calculators use the relative, and the rows are checked against the relative's sex. A relative named without an
 * age is not enough to trust the record, because the holder's age would be used with someone else's labs.
 */
export function notOnePersonReason(profile: Profile, rows: ReadonlyArray<{ name: string; label?: string }>): string | null {
  const subject = profile.subject
  const sex = subject && subject.age != null && (subject.sex === 'male' || subject.sex === 'female') ? subject.sex : profile.sex
  if (sex !== 'male' && sex !== 'female') return null
  const names = rows.map((row) => `${row.name} ${row.label ?? ''}`)
  const hit = sex === 'female' ? names.find((name) => MALE_ONLY_LAB.test(name)) : names.find((name) => FEMALE_ONLY_LAB.test(name))
  if (!hit) return null
  const example = sex === 'female' ? '前列腺特异性抗原' : '宫颈检查'
  const whose = sex === 'female' ? '男性' : '女性'
  return `记录里有${example}这类只有${whose}才做的检查，和档案里的性别对不上，像是两个人的体检放在了一起。身体年龄要用同一个人的血检和年龄来算，这次先不算。如果这是家人的体检，请在健康页「添加家人」为家人建立档案后再上传。`
}
