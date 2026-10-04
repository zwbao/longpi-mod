export type LongPiView = { tab: string }

declare module 'claude-code' {
  interface PluginState {
    longpi: {
      view: LongPiView
    }
  }
}
