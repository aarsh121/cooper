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

export interface CooperSettings {
  alwaysOnTop: boolean
  launchAtLogin: boolean
  showInTray: boolean
  opacity: number
}

export interface CooperState {
  items: CooperItem[]
  settings: CooperSettings
}

export const DEFAULT_SETTINGS: CooperSettings = {
  alwaysOnTop: true,
  launchAtLogin: true,
  showInTray: true,
  opacity: 1
}

export function parseSectionPrefix(raw: string): { section: string; text: string } {
  const match = raw.match(/^#\s*([^\n]+)\n([\s\S]*)$/)
  if (match) {
    return { section: match[1].trim(), text: match[2].trim() }
  }
  const inline = raw.match(/^\[([^\]]+)\]\s*([\s\S]+)$/)
  if (inline) {
    return { section: inline[1].trim(), text: inline[2].trim() }
  }
  return { section: '', text: raw.trim() }
}
