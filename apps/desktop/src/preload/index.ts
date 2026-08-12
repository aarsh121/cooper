import { contextBridge, ipcRenderer } from 'electron'
import type { CooperItem, CooperSettings, CooperState, ItemKind } from '../shared/types'

const api = {
  getState: (): Promise<CooperState> => ipcRenderer.invoke('cooper:get-state'),
  addItem: (text: string, kind?: ItemKind): Promise<CooperItem> =>
    ipcRenderer.invoke('cooper:add-item', text, kind),
  updateItem: (
    id: string,
    patch: Partial<Pick<CooperItem, 'text' | 'done' | 'kind'>>
  ): Promise<CooperItem | null> => ipcRenderer.invoke('cooper:update-item', id, patch),
  removeItem: (id: string): Promise<boolean> => ipcRenderer.invoke('cooper:remove-item', id),
  clearDone: (): Promise<number> => ipcRenderer.invoke('cooper:clear-done'),
  setSettings: (partial: Partial<CooperSettings>): Promise<CooperSettings> =>
    ipcRenderer.invoke('cooper:set-settings', partial),
  copyText: (text: string): Promise<boolean> => ipcRenderer.invoke('cooper:copy-text', text),
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
