// The slice of Node's `process` the core reads: the environment, the platform, a pid for temp names.

import { hasHost, host } from './host.ts'

const fallbackEnv: Record<string, string | undefined> = {}

export const process = {
  get env(): Record<string, string | undefined> {
    return hasHost() ? host().env : fallbackEnv
  },
  get platform(): string {
    return hasHost() ? host().platform : 'darwin'
  },
  pid: 4242,
  cwd(): string {
    return hasHost() ? host().home : '/'
  },
  versions: { node: '22.19.0' },
}

export default process
