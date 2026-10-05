import { describe, expect, test } from 'claude-code/testing'

import { noduleSizeCm } from '../hooks/core/datain/index.ts'
import { parseNarrative } from '../hooks/core/datain/narrative.ts'
import { normalizeText, notFiled, reportItems } from '../hooks/app/coverage.ts'

// The rules behind what a report turns into: nodule sizes, exam lines kept per date, and the completeness check.

describe('report rules', () => {
  test('a nodule size reads in cm whatever the report wrote', () => {
    expect(noduleSizeCm('甲状腺 0.5×0.4cm，TI-RADS 3。')).toBe(0.5)
    expect(noduleSizeCm('右侧较大者约8*4mm')).toBe(0.8)
    expect(noduleSizeCm('结节 3.1×2.0cm')).toBe(3.1)
    expect(noduleSizeCm('TI-RADS 4a，未写大小')).toBe(null)
  })

  test('exam lines keep their own date, normal ones are dropped, a centimetre size survives', () => {
    const rows = parseNarrative([
      '甲状腺彩超 甲状腺右叶结节（C-TIRADS 3类），约0.5×0.4cm 2026-09-12',
      '腹部彩超 中度脂肪肝；胆囊息肉（约0.3cm） 2026-09-12',
      '颈动脉彩超 双侧颈动脉内中膜未见明显增厚，未见斑块 2026-09-12',
      '甲状腺彩超 双侧甲状腺囊性结节（TI-RADS分级 2类），左侧较大者约7*5mm 2026-03-06',
    ].join('\n'))
    expect(rows.map((row) => `${row.date} ${row.kind} ${row.text_zh}`)).toEqual([
      '2026-09-12 ti-rads 甲状腺 0.5×0.4cm，TI-RADS 3。',
      '2026-09-12 ultrasound 腹部彩超：中度脂肪肝；胆囊息肉（约0.3cm）',
      '2026-03-06 ti-rads 甲状腺 7*5mm，TI-RADS 2。',
    ])
  })

  test('the completeness check reads radical look-alikes and lists what is not on file', () => {
    expect(normalizeText('⼼电图 未⻅明显异常')).toBe('心电图 未见明显异常')
    const items = reportItems(['腹部彩超', '检查项目 检查所见 单位', '⾎红蛋⽩ HGB 120 g/L 130-175', '丙氨酸氨基转移酶 ALT 64 U/L 9-50', '全国统一报告解读专线 400-081-8899'].join('\n'))
    expect(items.exams).toEqual(['腹部彩超'])
    expect(items.labs).toEqual(['血红蛋白', '丙氨酸氨基转移酶'])
    expect(notFiled(items, ['血红蛋白(HGB)'])).toEqual({ exams: ['腹部彩超'], labs: ['丙氨酸氨基转移酶'] })
  })
})
