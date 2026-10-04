import type { StoreKind } from '../contracts/library.ts'

export interface StoreReject {
  kind: StoreKind
  field: string
  reason: string
}

export interface StoreSummary {
  ok: boolean
  kind: StoreKind
  stored: number
  rejected: number
  on: boolean
  created: boolean
  coverage_zh: string
  reasons: Record<string, number>
  error?: string
}
