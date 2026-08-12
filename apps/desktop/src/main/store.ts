import Store from 'electron-store'
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'fs'
import { basename, extname, join } from 'path'
import * as electron from 'electron'
import { randomUUID } from 'crypto'
import {
  CooperAttachment,
  CooperItem,
  CooperSettings,
  CooperState,
  DEFAULT_SETTINGS,
  ItemKind,
  parseSectionPrefix
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

function normalizeItem(item: CooperItem): CooperItem {
  return {
    ...item,
    section: item.section ?? '',
    attachments: item.attachments ?? []
  }
}

export function getState(): CooperState {
  return {
    items: store.get('items').map(normalizeItem),
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
  return store.get('items').map(normalizeItem)
}

function attachmentsDir(): string {
  const dir = join(electron.app.getPath('userData'), 'attachments')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function importAttachment(sourcePath: string): CooperAttachment {
  const id = randomUUID()
  const name = basename(sourcePath)
  const dest = join(attachmentsDir(), `${id}${extname(name)}`)
  copyFileSync(sourcePath, dest)
  const { size } = statSync(dest)
  return {
    id,
    name,
    path: dest,
    mime: guessMime(name),
    size
  }
}

export function saveAttachmentBuffer(
  bytes: Uint8Array | Buffer,
  fileName: string,
  mime?: string
): CooperAttachment {
  const id = randomUUID()
  const safeName = fileName.replace(/[<>:"/\\|?*]/g, '_') || `paste-${Date.now()}.png`
  const ext = extname(safeName) || extensionForMime(mime)
  const name = extname(safeName) ? safeName : `${safeName}${ext}`
  const dest = join(attachmentsDir(), `${id}${ext}`)
  writeFileSync(dest, Buffer.from(bytes))
  const { size } = statSync(dest)
  return {
    id,
    name,
    path: dest,
    mime: mime || guessMime(name),
    size
  }
}

function extensionForMime(mime?: string): string {
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/gif') return '.gif'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/png') return '.png'
  return '.png'
}

function guessMime(name: string): string {
  const ext = extname(name).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.md') return 'text/markdown'
  if (ext === '.txt') return 'text/plain'
  if (ext === '.json') return 'application/json'
  return 'application/octet-stream'
}

export function addItem(
  text: string,
  kind: ItemKind = 'note',
  options?: { section?: string; attachments?: CooperAttachment[] }
): CooperItem {
  const parsed = parseSectionPrefix(text)
  const now = Date.now()
  const item: CooperItem = {
    id: randomUUID(),
    kind,
    text: parsed.text,
    section: options?.section ?? parsed.section,
    done: false,
    attachments: options?.attachments ?? [],
    createdAt: now,
    updatedAt: now
  }
  const items = [item, ...store.get('items').map(normalizeItem)]
  store.set('items', items)
  return item
}

/** Prevent duplicate captures of the same text within a short window. */
export function addCaptureDeduped(text: string, kind: ItemKind = 'capture'): CooperItem | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const items = listItems()
  const recent = items[0]
  if (recent && recent.text === trimmed && Date.now() - recent.createdAt < 4000) {
    return null
  }
  return addItem(trimmed, kind)
}

export function updateItem(
  id: string,
  patch: Partial<Pick<CooperItem, 'text' | 'done' | 'kind' | 'section' | 'attachments'>>
): CooperItem | null {
  const items = store.get('items').map(normalizeItem)
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

export function removeItems(ids: string[]): number {
  const idSet = new Set(ids)
  const items = store.get('items')
  const next = items.filter((item) => !idSet.has(item.id))
  const removed = items.length - next.length
  store.set('items', next)
  return removed
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
