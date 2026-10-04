// node:url. The core located its shipped files from its own module URL (lib/index.js in the npm
// package); here every such file sits under the mod's root, so the module URL is the root's lib/index.js.

import { host } from './host.ts'

export function libFile(): string {
  return `${host().pluginRoot}/lib/index.js`
}

export function libUrl(): string {
  return `file://${libFile()}`
}

export function fileURLToPath(url: string | URL): string {
  const text = String(url)
  return decodeURIComponent(text.startsWith('file://') ? text.slice('file://'.length) : text)
}

export function pathToFileURL(path: string): URL {
  return new URL(`file://${encodeURI(path)}`)
}

export default { fileURLToPath, pathToFileURL, libFile, libUrl }
