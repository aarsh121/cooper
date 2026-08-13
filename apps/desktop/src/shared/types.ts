export type ItemKind = 'note' | 'task' | 'capture' | 'file'

export interface CooperAttachment {
  id: string
  name: string
  path: string
  mime: string
  size: number
}

export interface CooperItem {
  id: string
  kind: ItemKind
  text: string
  section: string
  done: boolean
  attachments: CooperAttachment[]
  createdAt: number
  updatedAt: number
}

export type AppTheme = 'light' | 'dark'

export interface CooperSettings {
  alwaysOnTop: boolean
  launchAtLogin: boolean
  showInTray: boolean
  opacity: number
  activeSection: string
  theme: AppTheme
  fontSize: number
}

export interface CooperState {
  items: CooperItem[]
  settings: CooperSettings
}

export interface SnipInitPayload {
  png: Uint8Array
  width: number
  height: number
}

export const DEFAULT_SETTINGS: CooperSettings = {
  alwaysOnTop: true,
  launchAtLogin: true,
  showInTray: true,
  opacity: 1,
  activeSection: '',
  theme: 'light',
  fontSize: 14
}

export const MIN_FONT_SIZE = 12
export const MAX_FONT_SIZE = 20

function normalizeSectionName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed || /^inbox$/i.test(trimmed)) return ''
  return trimmed
}

export function parseSectionPrefix(raw: string): { section?: string; text: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { text: '' }

  const headingBlock = trimmed.match(/^##\s*([^\n]+)\n+([\s\S]*)$/)
  if (headingBlock) {
    return { section: normalizeSectionName(headingBlock[1]), text: headingBlock[2].trim() }
  }

  const headingSplit = trimmed.match(/^##\s*([^:\n|]+)\s*[:|]\s*([\s\S]*)$/)
  if (headingSplit) {
    return { section: normalizeSectionName(headingSplit[1]), text: headingSplit[2].trim() }
  }

  const headingOnly = trimmed.match(/^##\s*(.*)$/)
  if (headingOnly) {
    return { section: normalizeSectionName(headingOnly[1]), text: '' }
  }

  const match = trimmed.match(/^#\s*([^\n]+)\n([\s\S]*)$/)
  if (match) {
    return { section: normalizeSectionName(match[1]), text: match[2].trim() }
  }
  const inline = trimmed.match(/^\[([^\]]+)\]\s*([\s\S]+)$/)
  if (inline) {
    return { section: normalizeSectionName(inline[1]), text: inline[2].trim() }
  }
  return { text: trimmed }
}
