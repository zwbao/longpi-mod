// What left this computer (client/science/translog.ts), the transparency export and the public registry.
import type { RenderElement } from 'claude-code'

import type { Ctx, Node } from '../../types.ts'
import { C, Section, fit } from '../../kit.tsx'
import { Fold, isOpen, P, wrapTo } from './bits.tsx'
import { localText, scrubVisible, STATUS_ZH } from './copy.ts'
import type { Chain, LogRow, Registry, Transparency } from './science-data.ts'

/** 「10 月 4 日 22:41」 in this computer's clock. */
function whenOf(iso: string, today: string): string {
  const at = new Date(iso)
  if (!Number.isFinite(at.getTime())) return iso.slice(0, 16).replace('T', ' ')
  const y = at.getFullYear()
  const md = `${at.getMonth() + 1} 月 ${at.getDate()} 日`
  const hm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  return `${String(y) === today.slice(0, 4) ? md : `${y} 年 ${md}`} ${hm}`
}

const chainLine = (chain: Chain | undefined): string =>
  !chain ? '' : chain.ok ? '记录前后相连，没有被改动过。' : `记录在第 ${chain.seq ?? '?'} 条处对不上，可能被改动过。`

export function TranslogCard(ctx: Ctx, rows: readonly LogRow[], chain: Chain | undefined): RenderElement {
  const { Box, Text } = ctx.E
  const newest = [...rows].sort((a, b) => b.seq - a.seq)
  const open = isOpen(ctx, 'log')
  const shown = open ? newest : newest.slice(0, 5)
  const inner = ctx.width - 4
  return Section(ctx.E, {
    key: 'translog', title: '发出记录', note: rows.length ? `${rows.length} 条` : '', width: ctx.width,
    children: rows.length === 0
      ? [P(ctx, '尚无数据离开这台电脑。此处仅记录发出的数据：发送时间及接收的研究。', 'empty', { dim: true })]
      : [
        P(ctx, '此处仅记录离开这台电脑的数据：发送时间及接收的研究。', 'lead', { dim: true }),
        ...shown.map((row) => {
          const when = whenOf(row.at, ctx.today)
          return (
            <Box key={`log-${row.seq}`} flexDirection="row" justifyContent="space-between" width={inner}>
              <Box flexDirection="column" width={Math.max(10, inner - 20)}>
                <Text wrap="wrap">{wrapTo(scrubVisible(localText(row.detail_zh)), Math.max(10, inner - 20))}</Text>
              </Box>
              <Text dimColor>{when}</Text>
            </Box>
          )
        }),
        newest.length > 5 ? Fold(ctx, 'log', `全部 ${newest.length} 条`) : null,
        chain ? P(ctx, chainLine(chain), 'chain', { dim: chain.ok, color: chain.ok ? undefined : C.warn }) : null,
      ],
  })
}

export function TransparencyCard(ctx: Ctx, data: Transparency | null, error: string): Node {
  const { Box, Button } = ctx.E
  if (!data && !error) return null
  const text = data?.text ?? ''
  const lines = text ? text.trim().split('\n').length : 0
  return Section(ctx.E, {
    key: 'transparency', title: '透明记录导出', width: ctx.width,
    children: error
      ? [P(ctx, `没有读到：${error}`, 'err', { color: C.warn })]
      : [
        P(ctx, data?.export_zh || '透明记录可以导出。里面没有化验数值。', 'lead', { dim: true }),
        P(ctx, chainLine(data?.chain), 'chain', { dim: true }),
        <Box key="acts" flexDirection="row" gap={1}>
          <Button key="copy-log" label={lines ? `复制透明记录（${lines} 条）` : '复制透明记录'} onPress={() => (text ? ctx.act.copy(text) : ctx.act.toast('还没有记录可以导出。'))} />
        </Box>,
      ],
  })
}

const short = (hash: string) => (hash ? `${hash.slice(0, 12)}…` : '—')

export function RegistryCard(ctx: Ctx, data: Registry | null, error: string, said = ''): Node {
  if (!data && !error) return null
  const { Box, Text } = ctx.E
  const rows = data?.rows ?? []
  const hashes = isOpen(ctx, 'hashes')
  const inner = ctx.width - 4
  return Section(ctx.E, {
    key: 'registry', title: '公开登记', note: '研究说明、人数线和代码核对', width: ctx.width,
    children: error
      ? [P(ctx, `没有读到：${error}`, 'err', { color: C.warn })]
      : [
        data?.reason_zh && localText(data.reason_zh) !== localText(said) ? P(ctx, localText(data.reason_zh), 'reason', { dim: true }) : null,
        ...(rows.length === 0 ? [P(ctx, '还没有已签名的研究说明。', 'none', { dim: true })] : rows.map((row) => (
          <Box key={`reg-${row.id}`} flexDirection="column" marginTop={1} width={inner}>
            <Box flexDirection="row" gap={1} flexWrap="wrap">
              <Text bold>{row.title_zh}</Text>
              <Text color={C.accent}>{`[${STATUS_ZH[row.sim_status] ?? row.sim_status}]`}</Text>
              <Text dimColor>{row.line_zh.includes('招募中') ? row.line_zh : `${row.enrolled} / ${row.threshold}`}</Text>
            </Box>
            <Text dimColor wrap="wrap">{wrapTo(`伦理：${scrubVisible(row.ethics_zh) || '—'} · 对外收集：${scrubVisible(row.live_zh) || '—'}`, inner)}</Text>
            {hashes
              ? (
                <Box flexDirection="column">
                  <Text dimColor>{fit(`版本 ${row.version} · 说明指纹 ${short(row.manifest_sha256)}`, inner)}</Text>
                  <Text dimColor>{fit(`签名 ${row.key_id} · 分析代码指纹 ${short(row.analysis_sha256)}`, inner)}</Text>
                </Box>
              )
              : null}
          </Box>
        ))),
        Fold(ctx, 'hashes', '核对用的指纹（说明和分析代码没被改过）', '收起指纹'),
        P(ctx, '发出记录可以导出。这里没有个人化验，也没有理解测验的答案。', 'foot', { dim: true }),
      ],
  })
}
