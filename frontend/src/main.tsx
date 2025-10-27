import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { WebSocketProvider } from './context/WebSocketContext'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WebSocketProvider>
      <App />
    </WebSocketProvider>
  </React.StrictMode>
)
