// The one prompt slot in the workday (docs/codex-design.md §2), here the row above Claude Code's prompt. Two
// kinds only: the stand-up reminder (wristband owners who turned it on, ≥90 min of continuous use, a Claude turn
// running ≥60 s; no reward, no health number, no time promise) and, on a reveal day, 「有一张实验卡可以翻了」.
// Nothing in 演示模式. Ported from the web's slot-rules.ts and slot.ts.

import type { RenderElement } from 'claude-code'

import type { Els } from './types.ts'

export const SITTING_MIN = 90
export const TURN_MS = 60_000
/** A pause this long counts as having got up. */
export const BREAK_MS = 5 * 60_000
/** A stand-up line nobody answered folds away after this; it still counted as shown. */
export const STANDUP_VISIBLE_MS = 3 * 60_000

export type Activity = { since: number; last: number }

/** One sign of the person at the keyboard: a long enough pause before it starts a new sitting. */
export function noteInput(now: number, prev: Activity | null): Activity {
  if (!prev || now - prev.last >= BREAK_MS) return { since: now, last: now }
  return { since: prev.since, last: now }
}

/** Minutes of continuous use; 0 after a pause of 5 minutes or more. */
export function sittingMinutes(activity: Activity | null, now: number): number {
  if (!activity || now - activity.last >= BREAK_MS) return 0
  return (now - activity.since) / 60_000
}

export function sittingZh(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  const hours = Math.floor(m / 60)
  const rest = m % 60
  if (hours === 0) return `${rest} 分钟`
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分`
}

export type SlotView = { standup: boolean; standups_left: number; reveal: null | { ref: string; text_zh: string }; quiet: string | null }
export type BandPrompt = { kind: 'standup' | 'reveal' | 'news' | 'welcome' | 'today'; ref: string; text: string; at: number }

export function nextBand(input: { enabled: boolean; presentation: boolean; slot: SlotView | null; sitting: number; turnMs: number; now: number }): BandPrompt | null {
  if (!input.enabled || input.presentation || !input.slot) return null
  if (input.slot.reveal) return { kind: 'reveal', ref: input.slot.reveal.ref, text: input.slot.reveal.text_zh, at: input.now }
  if (input.slot.standup && input.sitting >= SITTING_MIN && input.turnMs >= TURN_MS) {
    return { kind: 'standup', ref: '', text: `已经坐了 ${sittingZh(input.sitting)}。起来走两分钟？`, at: input.now }
  }
  return null
}

export type BandActions = {
  todayOpen: () => void
  todayLater: () => void
  welcomeOpen: () => void
  welcomeLater: () => void
  newsOpen: (ref: string) => void
  newsLater: (ref: string) => void
  standupOk: () => void
  standupOff: () => void
  revealOpen: (ref: string) => void
  revealLater: (ref: string) => void
}

export function bandTree(E: Els, prompt: BandPrompt, act: BandActions): RenderElement {
  const { Box, Text, Button } = E
  const buttons = prompt.kind === 'today'
    ? [
      <Button key="lp-today-go" plain hotkey="y" label="打开" onPress={() => act.todayOpen()} />,
      <Button key="lp-today-later" plain hotkey="n" dimColor label="稍后" onPress={() => act.todayLater()} />,
    ]
    : prompt.kind === 'welcome'
    ? [
      <Button key="lp-welcome-go" plain hotkey="y" label="打开" onPress={() => act.welcomeOpen()} />,
      <Button key="lp-welcome-later" plain hotkey="n" dimColor label="知道了" onPress={() => act.welcomeLater()} />,
    ]
    : prompt.kind === 'news'
    ? [
      <Button key="lp-news-go" plain hotkey="y" label="去看" onPress={() => act.newsOpen(prompt.ref)} />,
      <Button key="lp-news-later" plain hotkey="n" dimColor label="稍后" onPress={() => act.newsLater(prompt.ref)} />,
    ]
    : prompt.kind === 'standup'
    ? [
      <Button key="lp-standup-ok" plain hotkey="y" label="好" onPress={() => act.standupOk()} />,
      <Button key="lp-standup-off" plain hotkey="n" dimColor label="今天别提醒了" onPress={() => act.standupOff()} />,
    ]
    : [
      <Button key="lp-reveal-go" plain hotkey="y" label="去看" onPress={() => act.revealOpen(prompt.ref)} />,
      <Button key="lp-reveal-later" plain hotkey="n" dimColor label="稍后" onPress={() => act.revealLater(prompt.ref)} />,
    ]
  return (
    <Box gap={2}>
      <Box flexShrink={1}>
        <Text wrap="truncate-end">{prompt.text}</Text>
      </Box>
      <Box flexShrink={0} gap={1}>{buttons}</Box>
    </Box>
  )
}
