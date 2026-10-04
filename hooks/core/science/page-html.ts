// A self-contained research page. The React tab renders the same CommunityView once the client registry is wired.

import type { CommunityView } from './community.ts'
import { RELEASE_STAYS_ZH } from './budget.ts'

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char))
}

export function communityHtml(view: CommunityView): string {
  const progress = view.progress.min_cohort > 0 ? Math.min(100, Math.round(100 * view.progress.contributed / view.progress.min_cohort)) : 0
  const studies = view.studies.map((study) => {
    const questions = study.questions.map((question) => `
      <fieldset>
        <legend>${esc(question.question_zh)}</legend>
        ${question.options_zh.map((option, index) => `<label><input type="radio" name="${esc(study.id)}::${esc(question.id)}" value="${index}"> ${esc(option)}</label>`).join('')}
      </fieldset>`).join('')
    const state = study.consented === 'granted' ? '已参加' : study.consented === 'withdrawn' ? '已退出' : '未参加'
    return `<article class="card" id="study-${esc(study.id)}">
      <p class="kicker">${esc(state)} · ${esc(study.kind === 'community_season' ? '社区赛季' : study.kind === 'n_of_1' ? '个人对照' : '观察')}</p>
      <h2>${esc(study.title_zh)}</h2>
      <p>${esc(study.summary_zh)}</p>
      <p>加入之后，研究正式开始才会把合计发出去。现在只保存在你的设备上。基因和姓名不参加。</p>
      <details><summary>完整同意书</summary><p class="prose">${esc(study.text_zh).replace(/\n/g, '<br>')}</p></details>
      <form data-consent="${esc(study.id)}">
        ${questions}
        <label class="confirm"><input type="checkbox" name="confirm"> 我看过说明，同意在这台电脑上参加</label>
        <button type="submit">加入</button>
        <button type="button" data-withdraw="${esc(study.id)}">退出这项研究</button>
        <span class="note">已经发出的合计不会收回。</span>
        <p class="status" data-status="${esc(study.id)}"></p>
      </form>
    </article>`
  }).join('')
  const topics = view.voting.topics.map((topic) => `
    <label class="topic"><input type="radio" name="topic" value="${esc(topic.id)}" ${view.voting.mine === topic.id ? 'checked' : ''}> ${esc(topic.title_zh)} <span>${topic.votes}</span></label>`).join('')
  const cards = view.cards.length === 0
    ? '<p class="note">贡献卡是你在这台电脑上参加研究之后留下的一张卡，和化验结果好坏无关。还没有贡献卡，完成本机计算后会出现在这里。</p>'
    : view.cards.map((card) => `<article class="card slim"><h3>${esc(card.title_zh)}</h3><p>${esc(card.body_zh)}</p></article>`).join('')
  const log = view.translog.length === 0
    ? '<p class="note">还没有东西离开这台电脑。</p>'
    : `<ol class="log">${view.translog.map((row) => `<li><span>${esc(row.at.slice(0, 16).replace('T', ' '))}</span> ${esc(row.detail_zh)}</li>`).join('')}</ol>`
  const lines = (view.thresholds ?? []).map((row) => `<p class="threshold" data-study="${esc(row.study_id)}"><strong>${esc(row.title_zh)}</strong> ${esc(row.line_zh)}</p>`).join('')
  const early = view.early_zh
    ? `<section class="card" id="cold-start"><p class="kicker">先做个人对照</p><p>${esc(view.early_zh)}</p><button type="button" id="start-nof1">开始个人对照</button><p class="status" id="nof1-status"></p></section>`
    : ''
  const pulse = view.pulse ? `<h2>${esc(view.pulse.headline_zh)}</h2><p>${esc(view.pulse.detail_zh)}</p>` : '<p>群体结果尚未发回。仅有一人时不会发布合计。</p>'
  return `<!doctype html>
<html lang="zh-CN">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LongPi 研究</title>
<style>
  :root { color-scheme: light; --ink:#14181f; --muted:#5c6570; --line:#e4e7ec; --card:#fff; --bg:#f4f6f8; --accent:#1f6feb; --wash:#e8f1fe; }
  * { box-sizing: border-box; }
  body { margin:0; font:16px/1.55 "PingFang SC","Noto Sans SC",sans-serif; color:var(--ink); background:var(--bg); }
  main { max-width:720px; margin:0 auto; padding:24px 16px 64px; }
  h1 { font-size:28px; line-height:1.25; margin:8px 0; }
  h2 { font-size:18px; margin:0 0 8px; }
  h3 { font-size:16px; margin:0 0 6px; }
  .kicker { color:var(--muted); font-size:13px; margin:0; }
  .banner { background:var(--wash); border-radius:12px; padding:12px 14px; margin:16px 0; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:16px; margin:12px 0; }
  .slim { padding:12px 14px; }
  .note { color:var(--muted); font-size:14px; }
  .bar { height:10px; background:#e6eaf0; border-radius:99px; overflow:hidden; }
  .bar span { display:block; height:100%; background:var(--accent); width:${progress}%; }
  fieldset { border:1px solid var(--line); border-radius:10px; margin:10px 0; }
  label { display:block; margin:6px 0; }
  button { background:var(--accent); color:#fff; border:0; border-radius:10px; padding:10px 14px; font:inherit; margin:6px 6px 0 0; }
  button[data-withdraw] { background:#fff; color:var(--ink); border:1px solid var(--line); }
  .status { min-height:1.2em; color:var(--muted); }
  .log { padding-left:18px; }
  .log span { color:var(--muted); font-size:13px; }
  .topic span { color:var(--muted); }
  @media (max-width:640px) { main { padding:16px 12px 48px; } button { width:100%; } }
</style>
<main>
  <p class="kicker">LongPi · 研究</p>
  <h1>一起看波动，原始数据留在这台电脑</h1>
  <div class="banner">${esc(view.reason_zh)}</div>
  <section class="card">
    <p class="kicker">研究进度 · 第 ${view.progress.week} 周 / 共 ${view.progress.weeks} 周</p>
    <h2>${esc(view.progress.label_zh)}</h2>
    <div class="bar" role="progressbar" aria-valuenow="${view.progress.contributed}" aria-valuemax="${view.progress.min_cohort}"><span></span></div>
    ${lines}
    <p>本机参加了 ${view.progress.studies} 项研究。发布合计至少需要 ${view.progress.min_cohort} 人，这一台电脑只算其中 ${view.progress.contributed} 人。</p>
  </section>
  ${early}
  <section class="card" id="pulse"><p class="kicker">大家的结果</p>${pulse}</section>
  <section class="card"><p class="kicker">发回给你</p><p>${esc(view.give_back_zh)}</p></section>
  <section class="card" id="vote">
    <p class="kicker">下个赛季的题目</p>
    <h2>你希望优先研究哪个题目</h2>
    <form id="vote-form">${topics}<button type="submit">提交投票</button></form>
    <p class="note">${esc(view.voting.note_zh)}</p>
  </section>
  ${studies}
  <section><h2>贡献卡</h2>${cards}</section>
  <section class="card"><h2>发出记录</h2><p class="note">这里只记离开这台电脑的东西：什么时候、发给哪一项研究。</p>${log}</section>
  <p class="note">基因、姓名、原始化验单和图片不参加。</p>
</main>
<script>
async function post(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.ok === false) throw new Error(json.reason_zh || json.error || ('HTTP ' + res.status))
  return json
}
document.querySelectorAll('form[data-consent]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const id = form.getAttribute('data-consent')
    const status = form.querySelector('[data-status]')
    const answers = []
    form.querySelectorAll('fieldset').forEach((field) => {
      const picked = field.querySelector('input:checked')
      const name = picked && picked.name.split('::')[1]
      if (picked) answers.push({ id: name, choice: Number(picked.value) })
    })
    try {
      await post('/api/longpi/science/consent', { confirm: form.confirm.checked === true, study_id: id, answers, explained_by: 'page' })
      status.textContent = '已记录同意。'
    } catch (error) { status.textContent = error.message }
  })
})
document.querySelectorAll('[data-withdraw]').forEach((button) => {
  button.addEventListener('click', async () => {
    const id = button.getAttribute('data-withdraw')
    const status = button.parentElement.querySelector('[data-status]')
    try {
      await post('/api/longpi/science/withdraw', { study_id: id, confirm: true })
      status.textContent = '已退出。尚未发出的部分已删除。已发出的合计无法收回。'
    } catch (error) { status.textContent = error.message }
  })
})
const nof1 = document.getElementById('start-nof1')
if (nof1) nof1.addEventListener('click', async () => {
  const status = document.getElementById('nof1-status')
  try {
    const json = await post('/api/longpi/science/n-of-1', { confirm: true, design: 'abab' })
    status.textContent = json.protocol_zh || '个人对照已安排，仅保存在这台电脑上。'
  } catch (error) { status.textContent = error.message }
})
document.getElementById('vote-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const picked = document.querySelector('input[name=topic]:checked')
  if (!picked) return
  try { await post('/api/longpi/science/community', { topic_id: picked.value }); location.reload() }
  catch (error) { alert(error.message) }
})
</script>`
}

export function offHtml(reason: string): string {
  return communityHtml({
    mode: 'off', configured: 'off', live_refused: false, reason_zh: reason, studies: [],
    progress: { label_zh: '研究', contributed: 0, studies: 0, min_cohort: 20, week: 0, weeks: 8 },
    pulse: null, voting: { topics: [], mine: null, note_zh: '' }, give_back_zh: '', cards: [], translog: [],
    thresholds: [], early_zh: '', release_stays_zh: RELEASE_STAYS_ZH,
  })
}
