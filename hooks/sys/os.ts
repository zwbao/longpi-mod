// node:os: the home directory and the temp directory the core names paths under.

import { host } from './host.ts'

export function homedir(): string {
  return host().home
}

export function tmpdir(): string {
  return host().env.TMPDIR?.replace(/\/$/, '') || '/tmp'
}

export function userInfo(): { username: string; homedir: string } {
  return { username: host().env.USER ?? '', homedir: host().home }
}

export function platform(): string {
  return host().platform
}

export const EOL = '\n'

export default { homedir, tmpdir, userInfo, platform, EOL }
