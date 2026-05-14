import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initRemoteConfig } from './lib/remoteConfig'

console.log('🚀 main.tsx starting...')

// Initialize Remote Config before mounting the app.
// Non-blocking: app renders immediately with fallback URL,
// then updates to the Remote Config value on the next API call.
initRemoteConfig().catch(() => {
  console.warn('Remote Config init failed — using fallback API URL.')
})

ReactDOM.createRoot(document.getElementById('app')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
