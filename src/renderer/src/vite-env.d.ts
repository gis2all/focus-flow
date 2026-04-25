/// <reference types="vite/client" />

import type { FocusFlowApi } from '@shared/contracts'

declare global {
  interface Window {
    focusFlow: FocusFlowApi
  }
}
