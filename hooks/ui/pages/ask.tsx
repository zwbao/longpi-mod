// The 问 LongPi page (client/life.ts AskTab): what Pi answers and how, the suggested questions in the person's own
// voice (about what changed and the next visit), and a field for their own question. Each press starts a turn
// with Pi in the conversation, as if they had typed it.

import type { RenderElement } from 'claude-code'

import type { Ctx, Node, Page } from '../types.ts'
import { C, Failed, Loading, routeState } from '../kit.tsx'
import { suggestedQuestions } from '../../core/ux/plain.ts'
import { journeyOf } from './overview/journey.ts'
import { Card, Para } from './overview/ui.tsx'

type Field = (props: Record<string, unknown>) => RenderElement

const LEAD = '随时可以提问。问用药、补剂、饮食、检查或身体不适，会先直接回答，再补充需要了解的信息；问记录变化和进度，回答分为三部分：观察到的情况、数据无法说明的内容、下一步。'

function draw(ctx: Ctx): Node {
  const { Box, Text, Button } = ctx.E
  const state = routeState(ctx, 'journey')
  if (state.kind === 'loading') return Loading(ctx.E)
  if (state.kind === 'error') return Failed(ctx.E, state.error, () => ctx.act.refresh())
  const journey = journeyOf(state.json)
  if (!journey) return Failed(ctx.E, '返回的不是 LongPi 的进度数据', () => ctx.act.refresh())
  const names = journey.changes.slice(0, 2).map((row) => row.label_zh)
  const visit = journey.reminders.find((row) => row.kind === 'retest')?.date ?? null
  const questions = suggestedQuestions({ changes: names, visit })
  const Input = 'Input' in ctx.E ? (ctx.E as unknown as { Input: Field }).Input : null
  const ask = (text: string) => {
    const said = text.trim()
    if (said) ctx.act.say(said)
  }
  return (
    <Box flexDirection="column" marginTop={1}>
      {Card(ctx, {
        key: 'ask', title: '可以这样问', width: ctx.width,
        children: [
          Para(ctx.E, LEAD, ctx.width - 4, { key: 'lead', dim: true }),
          <Box key="list" flexDirection="column" marginTop={1}>
            {questions.map((text, i) => <Button key={`ask-q${i}`} plain label={`› ${text}`} onPress={() => ask(text)} />)}
          </Box>,
        ],
      })}
      {Input
        ? (
          <Box key="own" flexDirection="column" borderStyle="round" borderColor={C.accent} paddingX={1} width={ctx.width}>
            <Text key="h" bold>你想问的话</Text>
            {Input({ key: 'ask-own', label: '问 Pi', placeholder: '例如：我的血脂需要吃药吗？', submitLabel: '发送', onSubmit: (value: string) => ask(value) })}
            <Text key="c" dimColor>按回车发送，Pi 会在对话里回答。</Text>
          </Box>
        )
        : null}
    </Box>
  )
}

export const page: Page = {
  tab: 'ask',
  label: '问 LongPi',
  routes: () => ['journey'],
  draw,
}
