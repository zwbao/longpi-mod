// Every page of the pane, in tab order. Primary pages show in the tab row; the rest under 更多.
import type { Page, Tab } from '../types.ts'
import { page as overview } from './overview.tsx'
import { page as labs } from './labs.tsx'
import { page as sleep } from './sleep.tsx'
import { page as training } from './training.tsx'
import { page as calendar } from './calendar.tsx'
import { page as analysis } from './analysis.tsx'
import { page as ask } from './ask.tsx'
import { page as plan } from './plan.tsx'
import { page as profile } from './profile.tsx'
import { page as science } from './science.tsx'
import { page as settings } from './settings.tsx'
import { page as codex } from '../codex/page.tsx'

export const PRIMARY: readonly Page[] = [overview, labs, sleep, training, calendar, plan, codex]
export const SECONDARY: readonly Page[] = [analysis, ask, profile, science, settings]
export const PAGES: readonly Page[] = [...PRIMARY, ...SECONDARY]

export function pageOf(tab: Tab): Page {
  return PAGES.find((page) => page.tab === tab) ?? overview
}

/** Hotkeys for the pages, while the pane holds the keyboard. */
export const HOTKEYS: Partial<Record<Tab, string>> = {
  overview: '1', labs: '2', sleep: '3', training: '4', calendar: '5', plan: '6', codex: '7',
  analysis: '8', ask: '9', profile: '0', science: 'r', settings: 's',
}
