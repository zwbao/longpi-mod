// GET /api/longpi/events (AA §2.6): a server-sent event stream the page listens to, so it hears within
// seconds that the chat changed something. Ids and kinds only, never health values; 25 s heartbeat.

import type { ServerResponse } from '../../sys/http.ts'
import type { Bus, HealthEventType } from '../contracts/events.ts'
import type { Http } from './http.ts'

const PUSHED: Partial<Record<HealthEventType, string>> = {
  'surface.generated': 'surfaces', 'memory.changed': 'memory', 'triage.opened': 'triage', 'triage.resolved': 'triage', 'care.visit_logged': 'triage',
  'brief.generated': 'triage', 'plan.saved': 'changed', 'checkin.logged': 'changed', 'selfmeasure.logged': 'changed', 'profile.changed': 'changed',
}

export interface Sse {
  publish(type: string, data: unknown): void
  clients(): number
}

export function createSse(http: Http, bus: Bus | null): Sse {
  const clients = new Set<ServerResponse>()
  const write = (res: ServerResponse, text: string) => {
    try {
      res.write(text)
    } catch {
      clients.delete(res)
    }
  }
  http.rawRoute('/api/longpi/events', (req, res) => {
    if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
      res.statusCode = 405
      res.end()
      return
    }
    res.statusCode = 200
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()
    write(res, 'retry: 5000\n: connected\n\n')
    clients.add(res)
    const heartbeat = setInterval(() => write(res, ': ping\n\n'), 25_000)
    heartbeat.unref?.()
    const close = () => {
      clearInterval(heartbeat)
      clients.delete(res)
    }
    req.on('close', close)
    res.on('close', close)
  })
  const publish = (type: string, data: unknown) => {
    const text = `event: ${type}\ndata: ${JSON.stringify(data ?? {})}\n\n`
    for (const res of [...clients]) write(res, text)
  }
  bus?.on(Object.keys(PUSHED) as HealthEventType[], (event) => {
    const type = PUSHED[event.type]
    if (type && event.type !== 'surface.generated') publish(type, { id: event.id, type: event.type })
  }, 'sse')
  return { publish, clients: () => clients.size }
}
