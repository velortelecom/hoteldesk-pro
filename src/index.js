import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import EssaiTermineGuard from './components/EssaiTermineGuard'

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
    {/* Monte a la racine : couvre toutes les pages, y compris l'ecran de
        connexion, sans qu'aucune n'ait a s'en preoccuper. */}
    <EssaiTermineGuard />
  </React.StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
