import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/theme.css'

const root = document.getElementById('root')!

if (!window.prime) {
  root.innerHTML =
    '<div style="font-family:Outfit,sans-serif;padding:48px;color:#0B1F3A"><h1>ResumePrime</h1><p>Preload bridge missing. Run via <code>npm run dev</code> (Electron), not a bare browser tab.</p></div>'
} else {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
