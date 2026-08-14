import * as electron from 'electron'
import { readFileSync, existsSync, statSync } from 'fs'
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
let injectingPaste = false
let inputLocked = false
let followupText = ''
let followupUntil = 0
let ctrlDown = false
let metaDown = false
const DOUBLE_MS = 380
const CAPTURE_GUARD_MS = 1600

export function setCaptureLocked(locked: boolean): void {
  inputLocked = locked
}

function isDouble(prev: number, now: number): boolean {
  return prev > 0 && now - prev > 50 && now - prev < DOUBLE_MS
}

async function readSelectionViaClipboard(): Promise<string> {
  if (isCapturing) return ''
  isCapturing = true
  const previous = electron.clipboard.readText()
  const marker = `__cooper_${Date.now()}__`
  electron.clipboard.writeText(marker)

  try {
    const mod = process.platform === 'darwin' ? UiohookKey.Meta : UiohookKey.Ctrl
    uIOhook.keyTap(UiohookKey.C, [mod])
    await new Promise((r) => setTimeout(r, 90))
    const copied = electron.clipboard.readText()

    if (!copied || copied === marker || copied === previous) {
      electron.clipboard.writeText(previous)
      return ''
    }

    setTimeout(() => electron.clipboard.writeText(previous), 300)
    return copied.trim()
  } catch {
    electron.clipboard.writeText(previous)
    return ''
  } finally {
    isCapturing = false
  }
}

export function startCaptureListener(onCapture: CaptureHandler, onToggle: () => void): void {
  try {
    electron.globalShortcut.register('CommandOrControl+Shift+C', async () => {
      const text = await readSelectionViaClipboard()
      if (text) onCapture(text, 'capture')
    })

    electron.globalShortcut.register('CommandOrControl+Shift+Space', () => onToggle())
  } catch (error) {
    console.error('Failed to register shortcuts:', error)
  }

  try {
    uIOhook.on('keydown', (event) => {
      if (event.keycode === UiohookKey.Ctrl || event.keycode === UiohookKey.CtrlRight) {
        ctrlDown = true
      }
      if (event.keycode === UiohookKey.Meta || event.keycode === UiohookKey.MetaRight) {
        metaDown = true
      }
      if (isCapturing || injectingPaste || inputLocked) return
      const isV = event.keycode === UiohookKey.V
      const pasteMod = process.platform === 'darwin' ? event.metaKey || metaDown : event.ctrlKey || ctrlDown
      if (isV && pasteMod) scheduleFollowupTextPaste()
    })

    uIOhook.on('keyup', (event) => {
      if (event.keycode === UiohookKey.Ctrl || event.keycode === UiohookKey.CtrlRight) {
        ctrlDown = false
      }
      if (event.keycode === UiohookKey.Meta || event.keycode === UiohookKey.MetaRight) {
        metaDown = false
      }
      if (isCapturing || injectingPaste || inputLocked) return
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
          if (text === lastCapturedText && Date.now() - lastCaptureAt < 4000) return
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
  try {
    electron.globalShortcut.unregisterAll()
  } catch {
    // ignore
  }
}

export function createHudWindow(): electron.BrowserWindow {
  const display = electron.screen.getPrimaryDisplay()
  const width = 220
  const height = 56
  const x = Math.round(display.workArea.x + (display.workArea.width - width) / 2)
  const y = Math.round(display.workArea.y + 48)

  const hud = new electron.BrowserWindow({
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

export function showHud(
  hud: electron.BrowserWindow | null,
  message: string,
  rendererUrl: string
): void {
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

function armTextAfterNextPaste(text: string): void {
  followupText = text
  followupUntil = Date.now() + 25000
}

function scheduleFollowupTextPaste(): void {
  if (injectingPaste || !followupText || Date.now() > followupUntil) return
  // Only inject into other apps. Cursor/VS Code drop text when an image is pasted.
  if (electron.BrowserWindow.getFocusedWindow()) return
  const text = followupText
  followupText = ''
  injectingPaste = true
  isCapturing = true
  setTimeout(() => {
    try {
      electron.clipboard.writeText(text)
      const mod = process.platform === 'darwin' ? UiohookKey.Meta : UiohookKey.Ctrl
      uIOhook.keyTap(UiohookKey.V, [mod])
    } catch (error) {
      console.error('Failed to paste follow-up text:', error)
    } finally {
      setTimeout(() => {
        injectingPaste = false
        isCapturing = false
      }, 250)
    }
  }, 320)
}

function writeSelectionClipboard(text: string, imagePaths: string[]): {
  copiedText: boolean
  copiedImages: number
} {
  const existingPaths = imagePaths.filter((p) => p && existsSync(p))
  const images = existingPaths
    .map((p) => electron.nativeImage.createFromPath(p))
    .filter((img) => !img.isEmpty())

  if (images.length === 0) {
    electron.clipboard.writeText(text || '')
    return { copiedText: Boolean(text), copiedImages: 0 }
  }

  const htmlImages = images
    .map((img) => `<img src="data:image/png;base64,${img.toPNG().toString('base64')}" />`)
    .join('')

  if (text) {
    // Chat apps treat image/* as the whole paste and skip text. Put the image on
    // the clipboard, then insert the text on the next Ctrl+V.
    electron.clipboard.write({
      image: images[0],
      html: `<html><body>${htmlImages}</body></html>`
    })
    armTextAfterNextPaste(text)
    return { copiedText: true, copiedImages: images.length }
  }

  electron.clipboard.write({
    image: images[0],
    html: `<html><body>${htmlImages}</body></html>`
  })
  return { copiedText: false, copiedImages: images.length }
}

export function registerIpc(getMainWindow: () => electron.BrowserWindow | null): void {
  electron.ipcMain.handle('cooper:get-state', () => data.getState())
  electron.ipcMain.handle(
    'cooper:add-item',
    (
      _e,
      text: string,
      kind?: ItemKind,
      options?: { section?: string; attachments?: CooperAttachment[] }
    ) => data.addItem(text, kind ?? 'note', options)
  )
  electron.ipcMain.handle(
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
  electron.ipcMain.handle('cooper:remove-item', (_e, id: string) => data.removeItem(id))
  electron.ipcMain.handle('cooper:remove-items', (_e, ids: string[]) => data.removeItems(ids))
  electron.ipcMain.handle('cooper:clear-done', () => data.clearDone())
  electron.ipcMain.handle('cooper:set-settings', (_e, partial: Partial<CooperSettings>) => {
    const settings = data.setSettings(partial)
    const win = getMainWindow()
    if (win && typeof partial.alwaysOnTop === 'boolean') {
      win.setAlwaysOnTop(partial.alwaysOnTop, 'floating')
    }
    if (win && typeof partial.opacity === 'number') {
      win.setOpacity(partial.opacity)
    }
    if (typeof partial.launchAtLogin === 'boolean') {
      electron.app.setLoginItemSettings({
        openAtLogin: partial.launchAtLogin,
        openAsHidden: true
      })
    }
    if (partial.theme === 'dark' || partial.theme === 'light') {
      electron.nativeTheme.themeSource = partial.theme
    }
    win?.webContents.send('cooper:state', data.getState())
    return settings
  })
  electron.ipcMain.handle('cooper:copy-text', (_e, text: string) => {
    electron.clipboard.writeText(text)
    return true
  })
  electron.ipcMain.handle('cooper:copy-as-list', (_e, texts: string[]) => {
    electron.clipboard.writeText(formatAsList(texts))
    return true
  })
  electron.ipcMain.handle(
    'cooper:copy-selection',
    (
      _e,
      payload: {
        texts: string[]
        imagePaths: string[]
      }
    ) => {
      const text = formatAsList(payload.texts.filter((t) => t.trim()))
      return writeSelectionClipboard(text, payload.imagePaths || [])
    }
  )
  electron.ipcMain.handle('cooper:pick-files', async () => {
    const win = getMainWindow()
    const options = {
      properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
      title: 'Attach files to TARS'
    }
    const picked = win
      ? await electron.dialog.showOpenDialog(win, options)
      : await electron.dialog.showOpenDialog(options)
    if (picked.canceled) return [] as CooperAttachment[]
    return picked.filePaths.map((p) => data.importAttachment(p))
  })
  electron.ipcMain.handle('cooper:import-paths', (_e, paths: string[]) => {
    const imported: CooperAttachment[] = []
    for (const p of paths) {
      try {
        if (!p || !existsSync(p) || statSync(p).isDirectory()) continue
        imported.push(data.importAttachment(p))
      } catch (error) {
        console.error('Failed to import dropped file:', p, error)
      }
    }
    return imported
  })
  electron.ipcMain.on('cooper:start-drag', (event, payload: { files?: string[] }) => {
    const files = [...new Set((payload?.files ?? []).filter((p) => p && existsSync(p)))]
    if (!files.length) {
      event.sender.send('cooper:drag-ended')
      return
    }
    try {
      // startDrag blocks until the OS drag session finishes.
      event.sender.startDrag(
        files.length === 1
          ? { file: files[0], icon: dragIcon(files[0]) }
          : { file: files[0], files, icon: dragIcon(files[0]) }
      )
    } catch (error) {
      console.error('Failed to start native file drag:', error)
    } finally {
      event.sender.send('cooper:drag-ended')
    }
  })
  electron.ipcMain.handle(
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
  electron.ipcMain.handle('cooper:paste-clipboard', () => {
    const image = electron.clipboard.readImage()
    if (!image.isEmpty()) {
      const png = image.toPNG()
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      return [data.saveAttachmentBuffer(png, `clipboard-${stamp}.png`, 'image/png')]
    }

    const formats = electron.clipboard.availableFormats()
    if (formats.includes('text/uri-list') || formats.includes('public.file-url')) {
      const uri =
        electron.clipboard.read('text/uri-list') || electron.clipboard.read('public.file-url')
      const paths = uri
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          try {
            return decodeURIComponent(
              line.replace(/^file:\/\//, '').replace(/^\/([A-Za-z]:)/, '$1')
            )
          } catch {
            return ''
          }
        })
        .filter(Boolean)
      if (paths.length) return paths.map((p) => data.importAttachment(p))
    }

    return [] as CooperAttachment[]
  })
  electron.ipcMain.handle('cooper:reveal-attachment', async (_e, filePath: string) => {
    await electron.shell.showItemInFolder(filePath)
    return true
  })
  electron.ipcMain.handle('cooper:read-attachment-data-url', (_e, filePath: string) => {
    try {
      if (!existsSync(filePath)) {
        console.error('Attachment missing:', filePath)
        return null
      }
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
    } catch (error) {
      console.error('Failed to read attachment:', filePath, error)
      return null
    }
  })
  electron.ipcMain.handle('cooper:open-data-file', async () => {
    await electron.shell.showItemInFolder(data.getDataFilePath())
    return data.getDataFilePath()
  })
  electron.ipcMain.handle('cooper:hide-window', () => {
    getMainWindow()?.hide()
  })
}

function dragIcon(filePath: string): electron.NativeImage {
  if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(filePath)) {
    const image = electron.nativeImage.createFromPath(filePath)
    if (!image.isEmpty()) return image.resize({ width: 64, height: 64 })
  }
  // Windows refuses to start a drag without a non-empty icon.
  return dotIcon(64)
}

export function trayIcon(): electron.NativeImage {
  return dotIcon(16)
}

function dotIcon(size: number): electron.NativeImage {
  const scale = 2
  const px = size * scale
  const buf = Buffer.alloc(px * px * 4)
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const dx = x - (px - 1) / 2
      const dy = y - (px - 1) / 2
      const inside = dx * dx + dy * dy <= (px * 0.32) * (px * 0.32)
      const i = (y * px + x) * 4
      if (inside) {
        buf[i] = 20
        buf[i + 1] = 20
        buf[i + 2] = 20
        buf[i + 3] = 255
      }
    }
  }
  return electron.nativeImage.createFromBuffer(buf, { width: px, height: px }).resize({
    width: size,
    height: size
  })
}
