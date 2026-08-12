import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  nativeTheme,
  screen
} from 'electron'
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

let mainWindow: BrowserWindow | null = null
let hudWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

const isDev = !app.isPackaged

function panelUrl(page = 'index.html'): string {
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    return `${process.env['ELECTRON_RENDERER_URL']}/${page}`
  }
  return `file://${join(__dirname, '../renderer', page)}`
}

function createMainWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()
  const width = 360
  const height = 520
  const x = Math.round(display.workArea.x + display.workArea.width - width - 24)
  const y = Math.round(display.workArea.y + 72)
  const settings = data.getSettings()

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 300,
    minHeight: 360,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    skipTaskbar: true,
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
  tray = new Tray(trayIcon())
  tray.setToolTip('Cooper')
  const contextMenu = Menu.buildFromTemplate([
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
        void import('electron').then(({ shell }) => {
          shell.showItemInFolder(data.getDataFilePath())
        })
      }
    },
    { type: 'separator' },
    {
      label: 'Quit Cooper',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setContextMenu(contextMenu)
  tray.on('click', () => togglePanel())
}

function broadcastState(): void {
  mainWindow?.webContents.send('cooper:state', data.getState())
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark'
  registerIpc(() => mainWindow)

  mainWindow = createMainWindow()
  hudWindow = createHudWindow()
  createTray()

  if (data.getSettings().launchAtLogin) {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })
  }

  startCaptureListener(
    (text, kind) => {
      if (!text) {
        showHud(hudWindow, 'Nothing selected', panelUrl('hud.html'))
        return
      }
      data.addItem(text, kind)
      broadcastState()
      showHud(hudWindow, 'Captured', panelUrl('hud.html'))
    },
    () => togglePanel()
  )

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
  stopCaptureListener()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in tray on Windows too for sticky-widget feel.
  }
})

app.on('will-quit', () => {
  stopCaptureListener()
})
