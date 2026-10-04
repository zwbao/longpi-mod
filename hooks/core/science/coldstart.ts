// Cold start copy. The count is whoever has joined, over the study's release threshold.
// Below the line, the page sends the person to a personal N-of-1 instead of an empty cohort answer.

export function groupThousands(value: number): string {
  const sign = value < 0 ? '-' : ''
  const digits = String(Math.abs(Math.trunc(value)))
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** The sentence the community page shows, including the grouped example 1,284 / 3,000. */
export function releaseLine(enrolled: number, threshold: number): string {
  return `${groupThousands(enrolled)} / ${groupThousands(threshold)}，到达后所有人一起看到答案`
}

export const EARLY_ZH = '人数尚未达到发布线。可先在这台电脑上进行个人对照：随机安排早晨走和晚饭后走，其间留几天照常生活、不作比较，结果仅保存在本机。人数达到后，所有人将同时看到群体结果。'

export interface ThresholdCard {
  study_id: string
  title_zh: string
  enrolled: number
  threshold: number
  line_zh: string
  early: boolean
}

export function thresholdCard(input: { study_id: string; title_zh: string; enrolled: number; threshold: number }): ThresholdCard {
  const enrolled = Math.max(0, Math.trunc(input.enrolled))
  const threshold = Math.max(1, Math.trunc(input.threshold))
  return {
    study_id: input.study_id,
    title_zh: input.title_zh,
    enrolled,
    threshold,
    line_zh: releaseLine(enrolled, threshold),
    early: enrolled < threshold,
  }
}
