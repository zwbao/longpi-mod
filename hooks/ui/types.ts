// The contract every LongPi page draws against. Pages are pure: a Ctx in, a tree out. register.tsx holds the
// engine, builds the Ctx for each draw, and runs what an action asks for; a page never touches `$`.

import type { Elements, RenderElement, RenderSurface } from 'claude-code'

import type { CodexOverlay, LongPiView, PrivacyState, RouteCache, Tab } from '../../types'

export type { Tab, LongPiView, RouteCache }

/** The element constructors of the surface being drawn (Box, Text, Button, ...). Raster only in the terminal. */
export type Els = Elements[keyof Elements]

export type Node = RenderElement | null

/** A route's path below /api/longpi/, as the web page called it: `journey`, `indicators?area=labs`, `codex/library`. */
export type RoutePath = string

export type PostOptions = {
  /** Routes to read again after the write (the page's own data). */
  reload?: readonly RoutePath[]
  /** A toast to show when the write answers ok. */
  done?: string
  /** Do not toast a failure (the page shows it itself). */
  quiet?: boolean
}

export type PostResult = { ok: boolean; status: number; json: Record<string, unknown> }

/** What a press can do. Every call is fire-and-forget from a Button's onPress, or awaited in a chain. */
export type Actions = {
  /** Show a page (and optionally set some of its `sub` values); the page's routes load. */
  go: (tab: Tab, sub?: Record<string, string>) => void
  /** Set one of the current page's small choices (a filter, a sub-tab, an expanded row). */
  setSub: (key: string, value: string) => void
  /** Open a detail on the page (an indicator id, a card id), or close it with null. */
  detail: (id: string | null) => void
  /** Read routes into the cache; `force` re-reads one already there. */
  load: (paths: readonly RoutePath[], force?: boolean) => void
  /** Re-read every route the current page uses (the 刷新 button), with ?refresh=1 on journey and tracking. */
  refresh: () => void
  /** POST (or another method) to a route, then reload what `options.reload` names. */
  post: (path: RoutePath, body: unknown, options?: PostOptions & { method?: 'POST' | 'PUT' | 'DELETE' }) => Promise<PostResult>
  /** Ask the person a question in a dialog: 2–4 options, or free text through the dialog's Other. */
  ask: (question: string, options: readonly string[], header?: string) => Promise<string | null>
  /** Start a coaching turn with Pi in the person's words (as if they typed it). */
  say: (text: string) => void
  /** Put text in the prompt for the person to edit and send. */
  fill: (text: string) => void
  toast: (text: string) => void
  copy: (text: string) => void
  /** Open personal numbers in the band and chat cards for 60 s (the 显示 button). */
  reveal: () => void
  /** 演示模式: hide every personal number and nudge until turned off. */
  setPresentation: (on: boolean) => void
  /** Codex stage: open a pack, reveal a run, show a card. Runs the animation; see ui/codex. */
  codex: CodexActions
  /** Write a route's text answer (a calendar file, a brief) to ~/Downloads/<fileName>; resolves the path, or null. */
  save: (path: RoutePath, fileName: string) => Promise<string | null>
  /** The same, answering `{ ok, path, error }` (the 档案 page's export). */
  saveFile: (path: RoutePath, fileName: string) => Promise<{ ok: boolean; path?: string; error?: string }>
  /** Close the pane. */
  close: () => void
}

export type CodexActions = {
  /** Open the stage over the 长寿图鉴 page: a pack, a reveal, a card to read, an experiment to choose. */
  open: (kind: CodexOverlay['kind'], id: string, payload: unknown, phase?: string) => void
  /** Tear the pack on the stage open (shake → burst → deal → flip). */
  tear: () => void
  /** Turn the experiment card on the stage over (the reveal). */
  turn: () => void
  /** Pick one of the three cards (null: back to the three). */
  pick: (optionId: string | null) => void
  answer: (questionId: string, yes: boolean) => void
  randomize: (on: boolean) => void
  /** Start the chosen experiment with the answers given. */
  begin: () => void
  close: () => void
  /** One Codex action (prefs, checkin, stop, start a season…); the page's data reloads after it. */
  act: (body: Record<string, unknown>) => Promise<PostResult>
}

export type Ctx = {
  E: Els
  surface: RenderSurface
  /** Columns the page may draw into (the pane body, less the page's own margin). */
  width: number
  view: LongPiView
  /** A route's cached answer, or undefined while it was never read. */
  route: (path: RoutePath) => RouteCache | undefined
  /** The JSON of a route that answered 200, or null. */
  json: <T = Record<string, unknown>>(path: RoutePath) => T | null
  privacy: PrivacyState & { shown: boolean }
  /** The Codex stage, when one is open. */
  overlay: CodexOverlay
  act: Actions
  now: number
  /** YYYY-MM-DD in the person's clock. */
  today: string
}

/** A page of the pane. `routes` are read when the page is shown; `draw` makes its body. */
export type Page = {
  tab: Tab
  label: string
  /** What the page reads. `json` holds the routes already answered, so a page may ask for more from what it learned. */
  routes: (view: LongPiView, json?: <T = Record<string, unknown>>(path: RoutePath) => T | null) => readonly RoutePath[]
  draw: (ctx: Ctx) => Node
}
