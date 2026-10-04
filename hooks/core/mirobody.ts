import type { Context } from '../sys/cordis.ts'

export interface MirobodyConfig {
  pythonBin: string
  mirobodyHome: string
  mcpUrl: string
  mcpToken: string
  timeoutMs: number
}

export interface MountState {
  mounted: boolean
  peer: boolean
  error: string
  pluginHome: string
}

/** The mod mounts no Mirobody plugin: its record lives on this computer (local-record.ts). */
export async function mountMirobody(_ctx: Context, _config: MirobodyConfig, pluginHome: string): Promise<MountState> {
  return { mounted: false, peer: false, error: '', pluginHome }
}
