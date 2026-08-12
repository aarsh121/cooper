import { contextBridge, ipcRenderer } from 'electron'
import type {
  CooperAttachment,
  CooperItem,
  CooperSettings,
  CooperState,
  ItemKind
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
  pickFiles: (): Promise<CooperAttachment[]> => ipcRenderer.invoke('cooper:pick-files'),
  importPaths: (paths: string[]): Promise<CooperAttachment[]> =>
    ipcRenderer.invoke('cooper:import-paths', paths),
  saveBuffer: (payload: {
    bytes: ArrayBuffer
    fileName: string
    mime?: string
  }): Promise<CooperAttachment> => ipcRenderer.invoke('cooper:save-buffer', payload),
  pasteClipboard: (): Promise<CooperAttachment[]> => ipcRenderer.invoke('cooper:paste-clipboard'),
  revealAttachment: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('cooper:reveal-attachment', filePath),
  readAttachmentDataUrl: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('cooper:read-attachment-data-url', filePath),
  openDataFile: (): Promise<string> => ipcRenderer.invoke('cooper:open-data-file'),
  hideWindow: (): Promise<void> => ipcRenderer.invoke('cooper:hide-window'),
  onState: (callback: (state: CooperState) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: CooperState): void => {
      callback(state)
    }
    ipcRenderer.on('cooper:state', listener)
    return () => ipcRenderer.removeListener('cooper:state', listener)
  }
}

contextBridge.exposeInMainWorld('cooper', api)

export type CooperApi = typeof api
