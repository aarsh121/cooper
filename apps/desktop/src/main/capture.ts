import {
  BrowserWindow,
  app,
  clipboard,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  shell
} from 'electron'
import { uIOhook, UiohookKey } from 'uiohook-napi'
import * as data from './store'

type CaptureHandler = (text: string, kind: 'capture' | 'note') => void

let lastLeftShift = 0
let lastRightShift = 0
let lastCaptureAt = 0
const DOUBLE_MS = 420
const CAPTURE_GUARD_MS = 900

function isDouble(prev: number, now: number): boolean {
  return now - prev > 40 && now - prev < DOUBLE_MS
}

async function readSelectionViaClipboard(): Promise<string> {
  const previous = clipboard.readText()
  const marker = `__cooper_${Date.now()}__`
  clipboard.writeText(marker)

  // Simulate Ctrl/Cmd+C without stealing focus permanently.
  // uiohook can emit key taps; on failure we fall back to empty.
  try {
    const mod = process.platform === 'darwin' ? UiohookKey.Meta : UiohookKey.Ctrl
    uIOhook.keyTap(UiohookKey.C, [mod])
  } catch {
    clipboard.writeText(previous)
    return ''
  }

  await new Promise((r) => setTimeout(r, 80))
  const copied = clipboard.readText()

  if (!copied || copied === marker || copied === previous) {
    clipboard.writeText(previous)
    return ''
  }

  // Restore previous clipboard after a short delay so paste still works for capture flows.
  setTimeout(() => clipboard.writeText(previous), 250)
  return copied.trim()
}

export function startCaptureListener(onCapture: CaptureHandler, onToggle: () => void): void {
  // Fallback hotkeys if raw Shift double-tap isn't available.
  globalShortcut.register('CommandOrControl+Shift+C', async () => {
    const text = await readSelectionViaClipboard()
    if (text) onCapture(text, 'capture')
  })

  globalShortcut.register('CommandOrControl+Shift+Space', () => onToggle())

  try {
    uIOhook.on('keydown', async (event) => {
      const now = Date.now()
      const isLeft = event.keycode === UiohookKey.Shift
      const isRight = event.keycode === UiohookKey.ShiftRight

      if (!isLeft && !isRight) return

      if (isLeft && isDouble(lastLeftShift, now)) {
        lastLeftShift = 0
        if (now - lastCaptureAt < CAPTURE_GUARD_MS) return
        lastCaptureAt = now
        const text = await readSelectionViaClipboard()
        onCapture(text, 'capture')
        return
      }

      if (isRight && isDouble(lastRightShift, now)) {
        lastRightShift = 0
        onToggle()
        return
      }

      if (isLeft) lastLeftShift = now
      if (isRight) lastRightShift = now
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
      preload: undefined,
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

export function registerIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('cooper:get-state', () => data.getState())
  ipcMain.handle('cooper:add-item', (_e, text: string, kind?: 'note' | 'task' | 'capture') =>
    data.addItem(text, kind ?? 'note')
  )
  ipcMain.handle(
    'cooper:update-item',
    (_e, id: string, patch: Partial<{ text: string; done: boolean; kind: 'note' | 'task' | 'capture' }>) =>
      data.updateItem(id, patch)
  )
  ipcMain.handle('cooper:remove-item', (_e, id: string) => data.removeItem(id))
  ipcMain.handle('cooper:clear-done', () => data.clearDone())
  ipcMain.handle('cooper:set-settings', (_e, partial: Partial<import('../shared/types').CooperSettings>) => {
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
  ipcMain.handle('cooper:open-data-file', async () => {
    await shell.showItemInFolder(data.getDataFilePath())
    return data.getDataFilePath()
  })
  ipcMain.handle('cooper:hide-window', () => {
    getMainWindow()?.hide()
  })
}

export function trayIcon(): Electron.NativeImage {
  // Minimal 16x16 copper-tinted dot as tray fallback.
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - 7.5
      const dy = y - 7.5
      const inside = dx * dx + dy * dy <= 5.5 * 5.5
      const i = (y * size + x) * 4
      if (inside) {
        buf[i] = 184
        buf[i + 1] = 115
        buf[i + 2] = 51
        buf[i + 3] = 255
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size })
}
