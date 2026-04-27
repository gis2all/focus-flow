import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { resolveWindowMode } from './windowMode'
import './styles/tokens.css'

const windowMode = resolveWindowMode(window.location.search)
document.documentElement.dataset.windowMode = windowMode
document.body.dataset.windowMode = windowMode

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App windowMode={windowMode} />
  </React.StrictMode>
)
