// The library pin. A result is not verified when the running catalog version
// is not the pinned one. An empty pin does not refuse.

export type PinLabel = 'verified' | 'unverified-binding' | 'evidence-only'

export interface PinCheck {
  pinned: string
  catalog: string
  matches: boolean | null
  verified_allowed: boolean
  label: PinLabel | null
  refused_verified: boolean
  mismatch: string
  mismatch_zh: string
}

function cleanVersion(value: string | undefined): string {
  return (value ?? '').trim().replace(/^v/, '')
}

/** Apply the pin to a proposed label. evidence-only and unverified-binding stay. */
export function applyVersionPin(catalogVersion: string, pinned: string, proposed?: PinLabel): PinCheck {
  const want = cleanVersion(pinned)
  const running = cleanVersion(catalogVersion)
  const matches = want ? running === want : null
  const verified_allowed = matches !== false
  let label: PinLabel | null = proposed ?? null
  let refused_verified = false
  if (proposed === 'verified' && !verified_allowed) {
    label = 'unverified-binding'
    refused_verified = true
  }
  const mismatch = matches === false
    ? `running catalog ${running || '(none)'} is not the pinned ${want}; a result from this pair cannot be labelled verified`
    : ''
  const mismatch_zh = matches === false
    ? `正在使用的方法库是 ${running || '（没有版本）'}，锁定版本是 ${want}，这次不能把结果标成已核对`
    : ''
  return { pinned: want, catalog: running, matches, verified_allowed, label, refused_verified, mismatch, mismatch_zh }
}
