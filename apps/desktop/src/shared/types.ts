export type ItemKind = 'note' | 'task' | 'capture'

export interface CooperItem {
  id: string
  kind: ItemKind
  text: string
  done: boolean
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
  opacity: 0.96
}
