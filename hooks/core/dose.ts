// An amount of a medicine or supplement, however it is written: 500 mg, 1,000 IU,
// 0.5 g, 2 x 500mg, 五百毫克, 两克, 一千五百国际单位, 二百五十微克, 半片, 五百 mg, and the
// full-width ０．５ｇ. One pattern for the plan (which never keeps a dose: it is
// stripped from every item and from the plan's own title and note) and for the
// follow-up filter (which never sends one). A concentration (42.6 mg/dL, 1 g/L)
// is a lab or trial value, not an amount taken, and a weight in 千克 is a body
// weight: neither is a dose.

/** Chinese numerals, with 点 for a decimal (六点八) and 半 (半片, 一片半). */
export const CN_NUMBER = '(?:[零〇一二两三四五六七八九十百千万]+(?:点[零〇一二两三四五六七八九]+)?半?|半)'
const DIGITS = '(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|\\.\\d+)'
// Mass, volume and international units, and counts of a form taken (粒, 片, 胶囊…).
const LATIN_UNIT = '(?:mcg|µg|μg|ug|mg|iu|ml|g|milligrams?|micrograms?|grams?|tablets?|capsules?|pills?|drops?)(?![A-Za-z])'
// 颗, 支, 袋 and 勺 are left out: 一勺橄榄油, 一袋牛奶 and 一支烟 are not doses, and every plan item is stripped.
const CN_UNIT = '(?:毫克|微克|国际单位|单位|(?<!千)克|毫升|粒|片|胶囊|丸|滴)'
// Not a dose when a volume follows: mg/dL, g/L, 毫克/分升.
const NOT_CONCENTRATION = '(?!\\s*[/／]\\s*(?:d?l|ml|分升|升|毫升)(?![A-Za-z]))'
// A number glued to a name is part of the name, not an amount: B12片, Q10胶囊, D3滴剂, Omega-3 胶囊 (a range, 5-10 mg,
// still is one). Glued to a Latin unit it is an amount all the same: D2000IU.
const LEAD = '(?<![A-Za-z0-9.])(?<![A-Za-z]-)'
const GLUED_UNIT = '(?:mcg|µg|μg|ug|mg|iu|ml|g)(?![A-Za-z])'
const FIRST = `(?:${LEAD}${DIGITS}|${CN_NUMBER})`
// "2 x 500mg" and "500mg/天" go as one piece, so neither half is left behind.
const TIMES = `${FIRST}\\s*[x×*]\\s*(?:${DIGITS}|${CN_NUMBER})`
const PER = '(?:\\s*[/／]\\s*(?:天|日|次|d|day)(?![A-Za-z]))?'
const SOURCE = `(?:(?:${TIMES}|${FIRST})\\s*(?:${LATIN_UNIT}|${CN_UNIT})|${DIGITS}${GLUED_UNIT})${NOT_CONCENTRATION}${PER}`

/** A fresh pattern: `g` for replacing, none for testing (a global pattern keeps lastIndex between tests). */
export function dosePattern(flags = 'i'): RegExp {
  return new RegExp(SOURCE, flags)
}

/** Full-width digits, letters and the marks between them (．，／％) as their plain forms; everything else as written. */
export function plainDigits(text: string): string {
  return text.replace(/[０-９Ａ-Ｚａ-ｚ．／％µ]/g, (char) => char === 'µ' ? 'μ' : char.normalize('NFKC'))
}

/** Whether the text names an amount of a medicine or supplement. */
export function hasDose(text: string): boolean {
  return dosePattern().test(plainDigits(text))
}

/**
 * The text without any amount of a medicine or supplement, and whether one was taken out. What is left is
 * tidied (a separator or empty bracket the amount leaves behind goes too) but never restored: a text that was
 * only a dose comes back empty.
 */
export function stripDoses(value: string): { text: string; stripped: boolean } {
  const before = value.trim()
  const plain = plainDigits(before)
  if (!dosePattern().test(plain)) return { text: before, stripped: false }
  const cleaned = plain.replace(dosePattern('gi'), ' ')
    .replace(/[（(]\s*[）)]/g, '')
    .replace(/\s*([，,、；;])\s*(?=[，,、；;。]|$)/g, '')
    .replace(/^[\s，,、；;。]+/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([，,、；;。])/g, '$1')
    .trim()
  return { text: cleaned, stripped: true }
}
