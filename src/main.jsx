import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { message } from 'antd'
import App from './App.jsx'

// Configure global message defaults
message.config({
  duration: 5, // 5 seconds
  maxCount: 3,
  top: 60,
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
