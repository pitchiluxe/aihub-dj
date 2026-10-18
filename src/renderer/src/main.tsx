import React from 'react'
import ReactDOM from 'react-dom/client'
import DjPage from './components/dj/DjPage'
import UpdateBar from './UpdateBar'
import './app.css'

// The whole window is the DJ console — the same DjPage AIHub Browser shows in its aihub://dj tab.
// No StrictMode: its double-mounted effects would open the audio engine and
// the YouTube player windows twice in development.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <div className="dj-app">
    <DjPage />
    <UpdateBar />
  </div>,
)
