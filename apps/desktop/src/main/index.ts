import * as electron from 'electron'
import { join } from 'path'
import {
  createHudWindow,
  registerIpc,
  showHud,
  startCaptureListener,
  stopCaptureListener,
  trayIcon
} from './capture'
import * as data from './store'

let mainWindow: electron.BrowserWindow | null = null
let hudWindow: electron.BrowserWindow | null = null
let tray: electron.Tray | null = null
let isQuitting = false

const isDev = !electron.app.isPackaged

if (process.platform === 'win32') {
  electron.app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
  electron.app.commandLine.appendSwitch('enable-smooth-scrolling')
}

function panelUrl(page = 'index.html'): string {
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/${page}`
  }
  return `file://${join(__dirname, '../renderer', page)}`
}

function createMainWindow(): electron.BrowserWindow {
  const display = electron.screen.getPrimaryDisplay()
  const width = 400
  const height = 640
  const x = Math.round(display.workArea.x + display.workArea.width - width - 24)
  const y = Math.round(display.workArea.y + 48)
  const settings = data.getSettings()

  const win = new electron.BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 320,
    minHeight: 420,
    maxWidth: 720,
    maxHeight: 1000,
    show: true,
    frame: false,
    transparent: true,
    resizable: true,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    alwaysOnTop: settings.alwaysOnTop,
    hasShadow: true,
    backgroundColor: '#00000000',
    title: 'TARS',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  win.setOpacity(settings.opacity)
  win.setResizable(true)
  if (settings.alwaysOnTop) {
    win.setAlwaysOnTop(true, 'floating')
  }

  void win.loadURL(panelUrl('index.html'))

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('Failed to load TARS UI:', code, desc)
  })

  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  return win
}

function togglePanel(): void {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
}

function createTray(): void {
  try {
    tray = new electron.Tray(trayIcon())
    tray.setToolTip('TARS')
    const contextMenu = electron.Menu.buildFromTemplate([
      {
        label: 'Show TARS',
        click: () => {
          mainWindow?.show()
          mainWindow?.focus()
        }
      },
      {
        label: 'Minimize TARS',
        click: () => mainWindow?.hide()
      },
      { type: 'separator' },
      {
        label: 'Open data file',
        click: () => {
          electron.shell.showItemInFolder(data.getDataFilePath())
        }
      },
      { type: 'separator' },
      {
        label: 'Quit TARS',
        click: () => {
          isQuitting = true
          electron.app.quit()
        }
      }
    ])
    tray.setContextMenu(contextMenu)
    tray.on('click', () => togglePanel())
  } catch (error) {
    console.error('Failed to create tray:', error)
  }
}

function broadcastState(): void {
  mainWindow?.webContents.send('cooper:state', data.getState())
}

electron.app.whenReady().then(() => {
  try {
    electron.nativeTheme.themeSource = data.getSettings().theme === 'dark' ? 'dark' : 'light'
    registerIpc(() => mainWindow)

    electron.ipcMain.handle('cooper:quit-app', () => {
      isQuitting = true
      stopCaptureListener()
      electron.app.quit()
    })

    electron.ipcMain.handle(
      'cooper:resize-by',
      (_e, delta: { dx: number; dy: number }) => {
        if (!mainWindow) return false
        const [width, height] = mainWindow.getSize()
        const nextW = Math.min(720, Math.max(320, width + Math.round(delta.dx)))
        const nextH = Math.min(1000, Math.max(420, height + Math.round(delta.dy)))
        mainWindow.setSize(nextW, nextH)
        return true
      }
    )

    mainWindow = createMainWindow()
    hudWindow = createHudWindow()
    createTray()

    // Don't auto-hide on login for first-run clarity.
    if (data.getSettings().launchAtLogin) {
      electron.app.setLoginItemSettings({ openAtLogin: true, openAsHidden: false })
    }

    try {
      startCaptureListener(
        (text, kind) => {
          if (!text) {
            showHud(hudWindow, 'Nothing selected', panelUrl('hud.html'))
            return
          }
          const item = data.addCaptureDeduped(text, kind)
          if (!item) {
            showHud(hudWindow, 'Already captured', panelUrl('hud.html'))
            return
          }
          broadcastState()
          showHud(hudWindow, 'Captured', panelUrl('hud.html'))
        },
        () => togglePanel()
      )
    } catch (error) {
      console.error('Capture listener failed (UI still available):', error)
    }

    electron.app.on('activate', () => {
      if (electron.BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      } else {
        mainWindow?.show()
      }
    })
  } catch (error) {
    console.error('TARS failed to start:', error)
  }
})

electron.app.on('before-quit', () => {
  isQuitting = true
  stopCaptureListener()
})

electron.app.on('window-all-closed', () => {
  // Keep running in tray on Windows for sticky-widget feel.
})

electron.app.on('will-quit', () => {
  stopCaptureListener()
})
