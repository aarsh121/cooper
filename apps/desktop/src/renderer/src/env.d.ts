import type { CooperApi, TarsApi } from '../../preload/index'

declare global {
  interface Window {
    tars: TarsApi
    cooper: CooperApi
  }
}

export {}
