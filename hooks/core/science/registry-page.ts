// Public study registry. Manifest id, signature key id, analysis-code hash, status, threshold.
// Comprehension answers are not copied onto this page.

import { createHash } from '../../sys/crypto.ts'
import { addNoise, gaussianSigma } from './dp.ts'
import { thresholdCard } from './coldstart.ts'
import { loadStudies } from './manifest.ts'
import { posteriorDiff } from './nof1-model.ts'
import { shamirReconstruct, shamirSplit } from './shamir.ts'
import { dealRound, finishRound, recoverServerSum } from './threshold.ts'
import { blocksLive, LIVE_REFUSED_ZH } from './verify.ts'
import type { TransparencyLogEntry } from '../contracts/science.ts'
import { exportTransparency } from './translog.ts'

export function analysisCodeHash(): string {
  const hash = createHash('sha256')
  for (const fn of [dealRound, finishRound, recoverServerSum, shamirSplit, shamirReconstruct, addNoise, gaussianSigma, posteriorDiff]) {
    hash.update(fn.name)
    hash.update(fn.toString())
  }
  return hash.digest('hex')
}

export interface RegistryRow {
  id: string
  version: string
  title_zh: string
  manifest_sha256: string
  key_id: string
  analysis_sha256: string
  sim_status: 'not_open' | 'collecting' | 'ready' | 'released'
  live_zh: string
  threshold: number
  enrolled: number
  line_zh: string
  ethics_zh: string
}

export function buildRegistry(opts: {
  mode: 'off' | 'local' | 'simulated' | 'live'
  enrolled?: Record<string, number>
  released?: Record<string, boolean>
}): { analysis_sha256: string; live_refused: boolean; reason_zh: string; rows: RegistryRow[] } {
  const analysis_sha256 = analysisCodeHash()
  const live_refused = true
  if (opts.mode === 'local') {
    return {
      analysis_sha256,
      live_refused,
      reason_zh: '研究正式开始后才会发出，现在只保存在你的设备上。',
      rows: loadStudies().map((row) => {
        const built = rowOf(row, analysis_sha256, 'collecting', 0, false)
        return { ...built, line_zh: `目标 ${built.threshold} 人 · 招募中`, live_zh: '还没有开始对外收集' }
      }),
    }
  }
  if (opts.mode === 'off' || opts.mode === 'live') {
    return {
      analysis_sha256,
      live_refused,
      reason_zh: opts.mode === 'live' ? LIVE_REFUSED_ZH : '研究没有打开。下面是已签名的研究说明，模拟模式才会收集。',
      rows: loadStudies().map((row) => rowOf(row, analysis_sha256, 'not_open', opts.enrolled?.[row.manifest.id] ?? 0, opts.released?.[row.manifest.id] === true)),
    }
  }
  return {
    analysis_sha256,
    live_refused,
    reason_zh: '模拟模式。live 在这个版本里不会打开。登记页只列说明、人数线和代码哈希，没有个人化验。',
    rows: loadStudies().map((row) => {
      const enrolled = opts.enrolled?.[row.manifest.id] ?? 0
      const threshold = row.manifest.analysis.release.min_cohort
      const released = opts.released?.[row.manifest.id] === true
      const status = released ? 'released' : enrolled >= threshold ? 'ready' : 'collecting'
      return rowOf(row, analysis_sha256, status, enrolled, released)
    }),
  }
}

function rowOf(row: ReturnType<typeof loadStudies>[number], analysis: string, status: RegistryRow['sim_status'], enrolled: number, _released: boolean): RegistryRow {
  const threshold = row.manifest.analysis.release.min_cohort
  const card = thresholdCard({ study_id: row.manifest.id, title_zh: row.manifest.title_zh, enrolled, threshold })
  const blocked = blocksLive(row.manifest)
  return {
    id: row.manifest.id,
    version: row.manifest.version,
    title_zh: row.manifest.title_zh,
    manifest_sha256: row.sha256,
    key_id: row.manifest.signature.key_id,
    analysis_sha256: analysis,
    sim_status: status,
    live_zh: blocked ?? 'live 仍关闭',
    threshold,
    enrolled: card.enrolled,
    line_zh: card.line_zh,
    ethics_zh: blocked ?? '伦理信息已填写',
  }
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char))
}

const STATUS_ZH: Record<RegistryRow['sim_status'], string> = {
  not_open: '未开放',
  collecting: '收集中',
  ready: '人数已到，尚未发布',
  released: '已发布',
}

export function registryHtml(view: ReturnType<typeof buildRegistry>): string {
  const rows = view.rows.map((row) => `<article class="card">
    <p class="kicker">${esc(STATUS_ZH[row.sim_status])} · live：${esc(row.live_zh)}</p>
    <h2>${esc(row.title_zh)}</h2>
    <p>${esc(row.line_zh)}</p>
    <dl>
      <dt>研究</dt><dd>${esc(row.id)} ${esc(row.version)}</dd>
      <dt>说明哈希</dt><dd><code>${esc(row.manifest_sha256)}</code></dd>
      <dt>签名密钥</dt><dd>${esc(row.key_id)}</dd>
      <dt>分析代码</dt><dd><code>${esc(row.analysis_sha256)}</code></dd>
      <dt>发布线</dt><dd>${row.line_zh.includes('招募中') ? esc(row.line_zh) : `${row.enrolled} / ${row.threshold}`}</dd>
      <dt>伦理</dt><dd>${esc(row.ethics_zh)}</dd>
    </dl>
  </article>`).join('')
  return `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LongPi 研究登记</title>
<style>
  body { margin:0; font:16px/1.55 "PingFang SC","Noto Sans SC",sans-serif; color:#14181f; background:#f4f6f8; }
  main { max-width:720px; margin:0 auto; padding:24px 16px 64px; }
  h1 { font-size:28px; line-height:1.25; }
  .card { background:#fff; border:1px solid #e4e7ec; border-radius:14px; padding:16px; margin:12px 0; }
  .kicker, dt { color:#5c6570; font-size:13px; }
  code { word-break:break-all; font-size:12px; }
  dl { display:grid; grid-template-columns:6.5em 1fr; gap:4px 8px; }
  @media (max-width:640px) { main { padding:16px 12px 48px; } dl { grid-template-columns:1fr; } }
</style>
<main>
  <p class="kicker">LongPi · 公开登记</p>
  <h1>研究说明、人数线和代码哈希</h1>
  <p>${esc(view.reason_zh)}</p>
  <p class="kicker">分析代码 sha256</p>
  <p><code>${esc(view.analysis_sha256)}</code></p>
  ${rows || '<p>还没有已签名的研究说明。</p>'}
  <p class="kicker">发出记录可以导出。这里没有个人化验，也没有理解测验的答案。</p>
</main>`
}

export function transparencyExport(entries: readonly TransparencyLogEntry[]): string {
  return exportTransparency(entries)
}
