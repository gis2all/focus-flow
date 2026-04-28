import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { BrowserEnvironmentNotice } from './BrowserEnvironmentNotice'
import { resolveWindowMode } from './windowMode'
import './styles/tokens.css'

const windowMode = resolveWindowMode(window.location.search)
document.documentElement.dataset.windowMode = windowMode
document.body.dataset.windowMode = windowMode
const hasFocusFlowApi = (): boolean => typeof (window as Window & { focusFlow?: unknown }).focusFlow !== 'undefined'
const rootView = hasFocusFlowApi() ? <App windowMode={windowMode} /> : <BrowserEnvironmentNotice />

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {rootView}
  </React.StrictMode>
)
