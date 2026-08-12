import Store from 'electron-store'
import { randomUUID } from 'crypto'
import {
  CooperItem,
  CooperSettings,
  CooperState,
  DEFAULT_SETTINGS,
  ItemKind
} from '../shared/types'

type StoreSchema = {
  items: CooperItem[]
  settings: CooperSettings
}

const store = new Store<StoreSchema>({
  name: 'cooper-data',
  defaults: {
    items: [],
    settings: DEFAULT_SETTINGS
  }
})

export function getState(): CooperState {
  return {
    items: store.get('items'),
    settings: { ...DEFAULT_SETTINGS, ...store.get('settings') }
  }
}

export function getSettings(): CooperSettings {
  return { ...DEFAULT_SETTINGS, ...store.get('settings') }
}

export function setSettings(partial: Partial<CooperSettings>): CooperSettings {
  const next = { ...getSettings(), ...partial }
  store.set('settings', next)
  return next
}

export function listItems(): CooperItem[] {
  return store.get('items')
}

export function addItem(text: string, kind: ItemKind = 'note'): CooperItem {
  const now = Date.now()
  const item: CooperItem = {
    id: randomUUID(),
    kind,
    text: text.trim(),
    done: false,
    createdAt: now,
    updatedAt: now
  }
  const items = [item, ...store.get('items')]
  store.set('items', items)
  return item
}

export function updateItem(
  id: string,
  patch: Partial<Pick<CooperItem, 'text' | 'done' | 'kind'>>
): CooperItem | null {
  const items = store.get('items')
  const index = items.findIndex((item) => item.id === id)
  if (index === -1) return null
  const updated: CooperItem = {
    ...items[index],
    ...patch,
    updatedAt: Date.now()
  }
  items[index] = updated
  store.set('items', items)
  return updated
}

export function removeItem(id: string): boolean {
  const items = store.get('items')
  const next = items.filter((item) => item.id !== id)
  if (next.length === items.length) return false
  store.set('items', next)
  return true
}

export function clearDone(): number {
  const items = store.get('items')
  const next = items.filter((item) => !item.done)
  const removed = items.length - next.length
  store.set('items', next)
  return removed
}

export function getDataFilePath(): string {
  return store.path
}
