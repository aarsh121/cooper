import type { CooperApi } from '../../preload/index'

declare global {
  interface Window {
    cooper: CooperApi
  }
}

export {}
