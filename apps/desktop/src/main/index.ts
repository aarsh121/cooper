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

function panelUrl(page = 'index.html'): string {
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/${page}`
  }
  return `file://${join(__dirname, '../renderer', page)}`
}

function createMainWindow(): electron.BrowserWindow {
  const display = electron.screen.getPrimaryDisplay()
  const width = 380
  const height = 640
  const x = Math.round(display.workArea.x + display.workArea.width - width - 24)
  const y = Math.round(display.workArea.y + 48)
  const settings = data.getSettings()

  const win = new electron.BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 300,
    minHeight: 360,
    show: true,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: false,
    alwaysOnTop: settings.alwaysOnTop,
    hasShadow: true,
    backgroundColor: '#00000000',
    title: 'Cooper',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setOpacity(settings.opacity)
  if (settings.alwaysOnTop) {
    win.setAlwaysOnTop(true, 'floating')
  }

  void win.loadURL(panelUrl('index.html'))

  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('Failed to load Cooper UI:', code, desc)
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
    tray.setToolTip('Cooper')
    const contextMenu = electron.Menu.buildFromTemplate([
      {
        label: 'Show Cooper',
        click: () => {
          mainWindow?.show()
          mainWindow?.focus()
        }
      },
      {
        label: 'Hide Cooper',
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
        label: 'Quit Cooper',
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
    electron.nativeTheme.themeSource = 'light'
    registerIpc(() => mainWindow)

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
    console.error('Cooper failed to start:', error)
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
