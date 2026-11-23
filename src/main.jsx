import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

// iOS Safari ignores `user-scalable=no`; cancelling its gesture events is what
// actually stops pinch-zooming the page. (The graph handles its own pinch
// through pointer events, which are unaffected.)
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, e => e.preventDefault(), { passive: false })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
