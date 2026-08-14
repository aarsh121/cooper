import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  CooperAttachment,
  CooperItem,
  CooperSettings,
  CooperState,
  ItemKind,
  SnipInitPayload
} from '../shared/types'

const api = {
  getState: (): Promise<CooperState> => ipcRenderer.invoke('cooper:get-state'),
  addItem: (
    text: string,
    kind?: ItemKind,
    options?: { section?: string; attachments?: CooperAttachment[] }
  ): Promise<CooperItem> => ipcRenderer.invoke('cooper:add-item', text, kind, options),
  updateItem: (
    id: string,
    patch: Partial<Pick<CooperItem, 'text' | 'done' | 'kind' | 'section' | 'attachments'>>
  ): Promise<CooperItem | null> => ipcRenderer.invoke('cooper:update-item', id, patch),
  removeItem: (id: string): Promise<boolean> => ipcRenderer.invoke('cooper:remove-item', id),
  removeItems: (ids: string[]): Promise<number> => ipcRenderer.invoke('cooper:remove-items', ids),
  clearDone: (): Promise<number> => ipcRenderer.invoke('cooper:clear-done'),
  setSettings: (partial: Partial<CooperSettings>): Promise<CooperSettings> =>
    ipcRenderer.invoke('cooper:set-settings', partial),
  copyText: (text: string): Promise<boolean> => ipcRenderer.invoke('cooper:copy-text', text),
  copyAsList: (texts: string[]): Promise<boolean> =>
    ipcRenderer.invoke('cooper:copy-as-list', texts),
  copySelection: (payload: {
    texts: string[]
    imagePaths: string[]
  }): Promise<{ copiedText: boolean; copiedImages: number }> =>
    ipcRenderer.invoke('cooper:copy-selection', payload),
  pickFiles: (): Promise<CooperAttachment[]> => ipcRenderer.invoke('cooper:pick-files'),
  importPaths: (paths: string[]): Promise<CooperAttachment[]> =>
    ipcRenderer.invoke('cooper:import-paths', paths),
  getPathForFile: (file: File): string => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  startDrag: (payload: { files: string[] }): void => {
    ipcRenderer.send('cooper:start-drag', payload)
  },
  onDragEnded: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('cooper:drag-ended', listener)
    return () => ipcRenderer.removeListener('cooper:drag-ended', listener)
  },
  saveBuffer: (payload: {
    bytes: ArrayBuffer
    fileName: string
    mime?: string
  }): Promise<CooperAttachment> => ipcRenderer.invoke('cooper:save-buffer', payload),
  pasteClipboard: (): Promise<CooperAttachment[]> => ipcRenderer.invoke('cooper:paste-clipboard'),
  revealAttachment: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('cooper:reveal-attachment', filePath),
  readAttachmentDataUrl: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('cooper:read-attachment-data-url', filePath),
  openDataFile: (): Promise<string> => ipcRenderer.invoke('cooper:open-data-file'),
  hideWindow: (): Promise<void> => ipcRenderer.invoke('cooper:hide-window'),
  startSnip: (): Promise<boolean> => ipcRenderer.invoke('cooper:start-snip'),
  cancelSnip: (): Promise<boolean> => ipcRenderer.invoke('cooper:cancel-snip'),
  snipReady: (): Promise<boolean> => ipcRenderer.invoke('cooper:snip-ready'),
  getSnipPayload: (): Promise<SnipInitPayload | null> => ipcRenderer.invoke('cooper:snip-payload'),
  completeSnip: (payload: { bytes: ArrayBuffer; fileName?: string }): Promise<CooperItem | null> =>
    ipcRenderer.invoke('cooper:complete-snip', payload),
  onSnipInit: (callback: (payload: SnipInitPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: SnipInitPayload): void => {
      callback(payload)
    }
    ipcRenderer.on('cooper:snip-init', listener)
    return () => ipcRenderer.removeListener('cooper:snip-init', listener)
  },
  quitApp: (): Promise<void> => ipcRenderer.invoke('cooper:quit-app'),
  resizeBy: (delta: { dx: number; dy: number }): Promise<boolean> =>
    ipcRenderer.invoke('cooper:resize-by', delta),
  onState: (callback: (state: CooperState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: CooperState): void => {
      callback(state)
    }
    ipcRenderer.on('cooper:state', listener)
    return () => ipcRenderer.removeListener('cooper:state', listener)
  }
}

contextBridge.exposeInMainWorld('tars', api)
// Keep legacy alias during rename.
contextBridge.exposeInMainWorld('cooper', api)

export type TarsApi = typeof api
export type CooperApi = TarsApi
