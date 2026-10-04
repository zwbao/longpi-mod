// GET /api/longpi/feedback — the same headlines the page and the chat use.

import type { CoreDeps } from '../contracts/index.ts'
import { feedbackFor } from './index.ts'
import { shareCard, shareText } from './share.ts'
import { dataDirOf, trackingNow } from './tools.ts'
import { rememberFeedback } from './record.ts'

export function registerFeedbackRoutes(deps: CoreDeps): void {
  deps.http.route('GET', '/api/longpi/feedback', async () => {
    const tracking = await trackingNow(deps)
    const messages = feedbackFor(tracking, deps.memory)
    const share = shareCard(messages)
    rememberFeedback(dataDirOf(deps), messages, deps.bus)
    return {
      today: tracking.today,
      messages,
      share: share ? { ...share, text_zh: shareText(share) } : null,
    }
  })
}
