/** The pages of the LongPi pane: the web health page's tabs, its secondary pages, and the settings page. */
export type Tab =
  | 'overview'
  | 'labs'
  | 'sleep'
  | 'training'
  | 'calendar'
  | 'analysis'
  | 'ask'
  | 'plan'
  | 'profile'
  | 'codex'
  | 'science'
  | 'settings'

/** Where the pane is: the page, small per-page choices (`sub`), and one open detail. */
export type LongPiView = {
  tab: Tab
  /** Per-page values by key, e.g. `labs.group`, `codex.tab`, `plan.edit`. */
  sub: Record<string, string>
  /** An open detail on the page (an indicator id, a study card id), or null. */
  detail: string | null
}

/** One route's last answer, as the page reads it. */
export type RouteCache = {
  at: number
  status: number
  json: unknown
  loading: boolean
  error: string
}

/** Personal numbers are folded by default in the band and the chat cards; 显示 opens them for 60 s. */
export type PrivacyState = {
  showUntil: number
  presentation: boolean
}

/** The Codex stage drawn over the 长寿图鉴 page: a pack being opened or a card being turned over. */
export type CodexOverlay = {
  kind: 'none' | 'pack' | 'reveal' | 'study' | 'result' | 'species' | 'choose' | 'footprint'
  /** pack id, run id, study card id or species key */
  id: string
  /** idle → shake → burst → deal → cards (pack); back → flip → front (reveal) */
  phase: string
  /** When the current phase started (ms), for the animation clock. */
  since: number
  /** Which of the dealt cards are face up. */
  flipped: boolean[]
  /** The option the person picked, or the result being shown. */
  chosen: string
  /** Data the stage draws (options, result cards), copied from the action's answer. */
  payload: unknown
  note: string
}

export type Notice = { text: string; tone: 'info' | 'good' | 'warn'; at: number } | null

declare module 'claude-code' {
  interface PluginState {
    longpi: {
      view: LongPiView
      data: Record<string, RouteCache>
      privacy: PrivacyState
      overlay: CodexOverlay
      notice: Notice
      tick: number
      booted: boolean
      /** This session is in coach mode: Pi's persona joins the system prompt. */
      coach: boolean
      /** The last turn used LongPi: the next prompt gets the snapshot. */
      healthTurn: boolean
      /** What a LongPi tool card in the transcript did (adopted, undone), by the call's id. */
      cards: Record<string, { adopted?: number; undone?: boolean; busy?: boolean; error?: string }>
      /** The prompt slot above the prompt: a stand-up line or the reveal notice. */
      band: { kind: 'standup' | 'reveal'; ref: string; text: string; at: number } | null
    }
  }
}
