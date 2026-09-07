import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { resolveWindowMode } from './windowMode'
import { createWebFocusFlowApi } from './web/api'
import './styles/tokens.css'

const windowMode = resolveWindowMode(window.location.search)
document.documentElement.dataset.windowMode = windowMode
document.body.dataset.windowMode = windowMode

const hasFocusFlowApi = (): boolean =>
  typeof (window as Window & { focusFlow?: unknown }).focusFlow !== 'undefined'

// In a browser tab (no Electron preload) we install the HTTP/SSE transport so
// the same renderer can be served as a web app. Electron loads the preload
// bridge instead and never reaches this branch.
if (!hasFocusFlowApi()) {
  window.focusFlow = createWebFocusFlowApi()
  document.documentElement.dataset.focusFlowWeb = 'true'
}

const rootView = <App windowMode={windowMode} />

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {rootView}
  </React.StrictMode>
)
