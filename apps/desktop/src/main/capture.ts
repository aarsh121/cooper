import { readFileSync } from 'fs'
import { extname as pathExtname } from 'path'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import * as data from './store'
import type { CooperAttachment, CooperSettings, ItemKind } from '../shared/types'

type CaptureHandler = (text: string, kind: 'capture' | 'note') => void

let lastLeftShiftUp = 0
let lastRightShiftUp = 0
let lastCaptureAt = 0
let lastCapturedText = ''
let isCapturing = false
const DOUBLE_MS = 380
const CAPTURE_GUARD_MS = 1600

function isDouble(prev: number, now: number): boolean {
  return prev > 0 && now - prev > 50 && now - prev < DOUBLE_MS
}

async function readSelectionViaClipboard(): Promise<string> {
  if (isCapturing) return ''
  isCapturing = true
  const previous = clipboard.readText()
  const marker = `__cooper_${Date.now()}__`
  clipboard.writeText(marker)

  try {
    const mod = process.platform === 'darwin' ? UiohookKey.Meta : UiohookKey.Ctrl
    uIOhook.keyTap(UiohookKey.C, [mod])
    await new Promise((r) => setTimeout(r, 90))
    const copied = clipboard.readText()

    if (!copied || copied === marker || copied === previous) {
      clipboard.writeText(previous)
      return ''
    }

    setTimeout(() => clipboard.writeText(previous), 300)
    return copied.trim()
  } catch {
    clipboard.writeText(previous)
    return ''
  } finally {
    isCapturing = false
  }
}

export function startCaptureListener(onCapture: CaptureHandler, onToggle: () => void): void {
  globalShortcut.register('CommandOrControl+Shift+C', async () => {
    const text = await readSelectionViaClipboard()
    if (text) onCapture(text, 'capture')
  })

  globalShortcut.register('CommandOrControl+Shift+Space', () => onToggle())

  try {
    // Use keyup so key-repeat while holding Shift never fires duplicates.
    uIOhook.on('keyup', (event) => {
      if (isCapturing) return
      const now = Date.now()
      const isLeft = event.keycode === UiohookKey.Shift
      const isRight = event.keycode === UiohookKey.ShiftRight
      if (!isLeft && !isRight) return

      if (isLeft && isDouble(lastLeftShiftUp, now)) {
        lastLeftShiftUp = 0
        if (now - lastCaptureAt < CAPTURE_GUARD_MS) return
        lastCaptureAt = now
        void (async () => {
          const text = await readSelectionViaClipboard()
          if (!text) {
            onCapture('', 'capture')
            return
          }
          if (text === lastCapturedText && now - lastCaptureAt < 4000) return
          lastCapturedText = text
          onCapture(text, 'capture')
        })()
        return
      }

      if (isRight && isDouble(lastRightShiftUp, now)) {
        lastRightShiftUp = 0
        onToggle()
        return
      }

      if (isLeft) lastLeftShiftUp = now
      if (isRight) lastRightShiftUp = now
    })

    uIOhook.start()
  } catch (error) {
    console.error('Failed to start low-level keyboard hook:', error)
  }
}

export function stopCaptureListener(): void {
  try {
    uIOhook.stop()
  } catch {
    // ignore
  }
  globalShortcut.unregisterAll()
}

export function createHudWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const width = 220
  const height = 56
  const x = Math.round(display.workArea.x + (display.workArea.width - width) / 2)
  const y = Math.round(display.workArea.y + 48)

  const hud = new BrowserWindow({
    width,
    height,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  hud.setIgnoreMouseEvents(true)
  hud.setAlwaysOnTop(true, 'screen-saver')
  return hud
}

export function showHud(hud: BrowserWindow | null, message: string, rendererUrl: string): void {
  if (!hud) return
  const html = `${rendererUrl}?message=${encodeURIComponent(message)}`
  void hud.loadURL(html).then(() => {
    hud.showInactive()
    setTimeout(() => {
      if (!hud.isDestroyed()) hud.hide()
    }, 1100)
  })
}

function formatAsList(texts: string[]): string {
  return texts.map((t) => `- ${t.trim()}`).join('\n')
}

export function registerIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('cooper:get-state', () => data.getState())
  ipcMain.handle(
    'cooper:add-item',
    (
      _e,
      text: string,
      kind?: ItemKind,
      options?: { section?: string; attachments?: CooperAttachment[] }
    ) => data.addItem(text, kind ?? 'note', options)
  )
  ipcMain.handle(
    'cooper:update-item',
    (
      _e,
      id: string,
      patch: Partial<{
        text: string
        done: boolean
        kind: ItemKind
        section: string
        attachments: CooperAttachment[]
      }>
    ) => data.updateItem(id, patch)
  )
  ipcMain.handle('cooper:remove-item', (_e, id: string) => data.removeItem(id))
  ipcMain.handle('cooper:remove-items', (_e, ids: string[]) => data.removeItems(ids))
  ipcMain.handle('cooper:clear-done', () => data.clearDone())
  ipcMain.handle('cooper:set-settings', (_e, partial: Partial<CooperSettings>) => {
    const settings = data.setSettings(partial)
    const win = getMainWindow()
    if (win && typeof partial.alwaysOnTop === 'boolean') {
      win.setAlwaysOnTop(partial.alwaysOnTop, 'floating')
    }
    if (win && typeof partial.opacity === 'number') {
      win.setOpacity(partial.opacity)
    }
    if (typeof partial.launchAtLogin === 'boolean') {
      app.setLoginItemSettings({ openAtLogin: partial.launchAtLogin, openAsHidden: true })
    }
    return settings
  })
  ipcMain.handle('cooper:copy-text', (_e, text: string) => {
    clipboard.writeText(text)
    return true
  })
  ipcMain.handle('cooper:copy-as-list', (_e, texts: string[]) => {
    clipboard.writeText(formatAsList(texts))
    return true
  })
  ipcMain.handle('cooper:pick-files', async () => {
    const win = getMainWindow()
    const options = {
      properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
      title: 'Attach files to Cooper'
    }
    const picked = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options)
    if (picked.canceled) return [] as CooperAttachment[]
    return picked.filePaths.map((p) => data.importAttachment(p))
  })
  ipcMain.handle('cooper:import-paths', (_e, paths: string[]) => {
    return paths.map((p) => data.importAttachment(p))
  })
  ipcMain.handle(
    'cooper:save-buffer',
    (
      _e,
      payload: { bytes: ArrayBuffer | Uint8Array; fileName: string; mime?: string }
    ) => {
      const bytes =
        payload.bytes instanceof ArrayBuffer
          ? new Uint8Array(payload.bytes)
          : Uint8Array.from(payload.bytes)
      return data.saveAttachmentBuffer(bytes, payload.fileName, payload.mime)
    }
  )
  ipcMain.handle('cooper:paste-clipboard', () => {
    const image = clipboard.readImage()
    if (!image.isEmpty()) {
      const png = image.toPNG()
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      return [data.saveAttachmentBuffer(png, `clipboard-${stamp}.png`, 'image/png')]
    }

    // Windows / macOS may expose file paths on clipboard when copying files.
    const formats = clipboard.availableFormats()
    if (formats.includes('text/uri-list') || formats.includes('public.file-url')) {
      const uri = clipboard.read('text/uri-list') || clipboard.read('public.file-url')
      const paths = uri
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return decodeURIComponent(line.replace(/^file:\/\//, '').replace(/^\/([A-Za-z]:)/, '$1'))
          } catch {
            return ''
          }
        })
        .filter(Boolean)
      if (paths.length) return paths.map((p) => data.importAttachment(p))
    }

    return [] as CooperAttachment[]
  })
  ipcMain.handle('cooper:reveal-attachment', async (_e, filePath: string) => {
    await shell.showItemInFolder(filePath)
    return true
  })
  ipcMain.handle('cooper:read-attachment-data-url', (_e, filePath: string) => {
    const bytes = readFileSync(filePath)
    const ext = pathExtname(filePath).toLowerCase()
    const mime =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.gif'
          ? 'image/gif'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.png'
              ? 'image/png'
              : 'application/octet-stream'
    return `data:${mime};base64,${bytes.toString('base64')}`
  })
  ipcMain.handle('cooper:open-data-file', async () => {
    await shell.showItemInFolder(data.getDataFilePath())
    return data.getDataFilePath()
  })
  ipcMain.handle('cooper:hide-window', () => {
    getMainWindow()?.hide()
  })
}

export function trayIcon(): Electron.NativeImage {
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - 7.5
      const dy = y - 7.5
      const inside = dx * dx + dy * dy <= 5.2 * 5.2
      const i = (y * size + x) * 4
      if (inside) {
        buf[i] = 23
        buf[i + 1] = 23
        buf[i + 2] = 23
        buf[i + 3] = 255
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size })
}
