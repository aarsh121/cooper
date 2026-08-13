import * as electron from 'electron'
import * as data from './store'
import { setCaptureLocked } from './capture'
import type { SnipInitPayload } from '../shared/types'

type SnipWindow = electron.BrowserWindow & {
  __snipPayload?: SnipInitPayload
  __snipBounds?: electron.Rectangle
}

let overlays: SnipWindow[] = []
let warm: SnipWindow | null = null
let starting = false
let savedOpacity = 1
let getMainWindow: () => electron.BrowserWindow | null = () => null
let panelUrl: (page: string) => string = () => ''
let preloadPath = ''
let showHud: (message: string) => void = () => undefined
let broadcastState: () => void = () => undefined

function isSnipping(): boolean {
  return overlays.some((win) => !win.isDestroyed() && win.isVisible())
}

function parkWindow(win: SnipWindow): void {
  if (win.isDestroyed()) return
  win.hide()
  win.setBounds({ x: -20000, y: -20000, width: 400, height: 300 })
}

function createOverlayWindow(): SnipWindow {
  const win = new electron.BrowserWindow({
    x: -20000,
    y: -20000,
    width: 400,
    height: 300,
    frame: false,
    transparent: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    enableLargerThanScreen: true,
    backgroundColor: '#111111',
    show: false,
    title: 'TARS Snip',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  }) as SnipWindow

  win.setAlwaysOnTop(true, 'screen-saver')
  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  } catch {
    // Windows / older Electron
  }
  win.setMenuBarVisibility(false)
  win.on('closed', () => {
    overlays = overlays.filter((entry) => entry !== win)
    if (warm === win) warm = null
    if (!overlays.length && !starting) setCaptureLocked(false)
  })
  void win.loadURL(panelUrl('snip.html'))
  return win
}

function ensureWarm(): SnipWindow {
  if (warm && !warm.isDestroyed()) return warm
  warm = createOverlayWindow()
  return warm
}

function whenLoaded(win: electron.BrowserWindow): Promise<void> {
  if (win.webContents.getURL() && !win.webContents.isLoading()) return Promise.resolve()
  return new Promise((resolve) => {
    const done = (): void => resolve()
    win.webContents.once('did-finish-load', done)
    setTimeout(done, 1200)
  })
}

async function captureDisplays(): Promise<{ display: electron.Display; png: Buffer }[]> {
  const displays = [...electron.screen.getAllDisplays()].sort((a, b) => {
    const primary = electron.screen.getPrimaryDisplay().id
    if (a.id === primary) return -1
    if (b.id === primary) return 1
    return a.bounds.x - b.bounds.x || a.bounds.y - b.bounds.y
  })
  const maxW = Math.max(...displays.map((d) => Math.round(d.size.width * d.scaleFactor)))
  const maxH = Math.max(...displays.map((d) => Math.round(d.size.height * d.scaleFactor)))
  const remaining = [
    ...(await electron.desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: maxW, height: maxH }
    }))
  ]
  const shots: { display: electron.Display; png: Buffer }[] = []

  for (const display of displays) {
    let index = remaining.findIndex((source) => source.display_id === String(display.id))
    if (index < 0) {
      const targetW = Math.round(display.size.width * display.scaleFactor)
      const targetH = Math.round(display.size.height * display.scaleFactor)
      index = remaining.findIndex((source) => {
        const size = source.thumbnail.getSize()
        return Math.abs(size.width - targetW) <= 2 && Math.abs(size.height - targetH) <= 2
      })
    }
    if (index < 0) index = 0
    const source = remaining.splice(index, 1)[0]
    if (!source || source.thumbnail.isEmpty()) continue
    shots.push({ display, png: source.thumbnail.toPNG() })
  }
  return shots
}

function closeOverlays(): void {
  for (const win of overlays) {
    if (win === warm) parkWindow(win)
    else if (!win.isDestroyed()) win.destroy()
  }
  overlays = []
  setCaptureLocked(false)
}

function restoreMainWindow(): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  win.setOpacity(savedOpacity)
  win.show()
  win.focus()
}

export function cancelSnip(): void {
  const wasOpen = isSnipping() || starting
  starting = false
  closeOverlays()
  if (wasOpen) restoreMainWindow()
}

export async function startSnip(): Promise<boolean> {
  if (starting || isSnipping()) {
    cancelSnip()
    return false
  }

  starting = true
  setCaptureLocked(true)

  if (process.platform === 'darwin') {
    try {
      const status = electron.systemPreferences.getMediaAccessStatus('screen')
      if (status === 'denied') {
        starting = false
        setCaptureLocked(false)
        showHud('Allow Screen Recording')
        void electron.shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
        )
        return false
      }
    } catch {
      // older Electron without screen TCC status
    }
  }

  const main = getMainWindow()
  const wasVisible = Boolean(main && !main.isDestroyed() && main.isVisible())
  if (main && wasVisible) {
    savedOpacity = main.getOpacity()
    main.setOpacity(0)
    main.hide()
  }

  const overlay = ensureWarm()
  await Promise.all([whenLoaded(overlay), new Promise((r) => setTimeout(r, 32))])

  let shots: { display: electron.Display; png: Buffer }[] = []
  try {
    shots = await captureDisplays()
  } catch (error) {
    console.error('Failed to capture screen:', error)
  }

  if (!shots.length) {
    starting = false
    setCaptureLocked(false)
    if (wasVisible) restoreMainWindow()
    showHud('Screen capture blocked')
    return false
  }

  for (let i = 0; i < shots.length; i++) {
    const { display, png } = shots[i]
    const payload = {
      png,
      width: display.bounds.width,
      height: display.bounds.height
    } as SnipInitPayload
    const win = i === 0 ? overlay : createOverlayWindow()
    if (i > 0) await whenLoaded(win)
    win.__snipPayload = payload
    win.__snipBounds = display.bounds
    win.setBounds(display.bounds)
    overlays.push(win)
    win.webContents.send('cooper:snip-init', payload)
  }

  starting = false
  if (!overlays.length) {
    setCaptureLocked(false)
    if (wasVisible) restoreMainWindow()
    showHud('Screen capture blocked')
    return false
  }
  return true
}

export function registerSnip(options: {
  getMainWindow: () => electron.BrowserWindow | null
  panelUrl: (page: string) => string
  preloadPath: string
  showHud: (message: string) => void
  broadcastState: () => void
}): void {
  getMainWindow = options.getMainWindow
  panelUrl = options.panelUrl
  preloadPath = options.preloadPath
  showHud = options.showHud
  broadcastState = options.broadcastState

  electron.ipcMain.handle('cooper:start-snip', () => startSnip())
  electron.ipcMain.handle('cooper:cancel-snip', () => {
    cancelSnip()
    return true
  })
  electron.ipcMain.handle('cooper:snip-payload', (event) => {
    const win = electron.BrowserWindow.fromWebContents(event.sender) as SnipWindow | null
    return win?.__snipPayload ?? null
  })
  electron.ipcMain.handle('cooper:snip-ready', (event) => {
    const win = electron.BrowserWindow.fromWebContents(event.sender) as SnipWindow | null
    if (!win || win.isDestroyed()) return false
    if (win.__snipBounds) win.setBounds(win.__snipBounds)
    win.show()
    win.focus()
    win.moveTop()
    return true
  })
  electron.ipcMain.handle(
    'cooper:complete-snip',
    (_e, payload: { bytes: ArrayBuffer | Uint8Array; fileName?: string }) => {
      try {
        const raw = payload.bytes
        const bytes = Buffer.isBuffer(raw)
          ? raw
          : Buffer.from(raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw)
        closeOverlays()
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const attachment = data.saveAttachmentBuffer(
          bytes,
          payload.fileName || `snip-${stamp}.png`,
          'image/png'
        )
        const item = data.addItem('Screenshot', 'file', { attachments: [attachment] })
        const image = electron.nativeImage.createFromBuffer(bytes)
        if (!image.isEmpty()) electron.clipboard.writeImage(image)
        restoreMainWindow()
        broadcastState()
        showHud('Snipped')
        return item
      } catch (error) {
        console.error('Failed to save snip:', error)
        closeOverlays()
        restoreMainWindow()
        showHud('Could not save snip')
        return null
      }
    }
  )

  try {
    electron.globalShortcut.register('CommandOrControl+Shift+X', () => {
      if (starting || isSnipping()) cancelSnip()
      else void startSnip()
    })
  } catch (error) {
    console.error('Failed to register snip shortcut:', error)
  }

  setTimeout(() => {
    try {
      ensureWarm()
    } catch (error) {
      console.error('Failed to prewarm snip overlay:', error)
    }
  }, 250)
}

export function stopSnip(): void {
  closeOverlays()
  starting = false
  if (warm && !warm.isDestroyed()) {
    warm.destroy()
    warm = null
  }
}
