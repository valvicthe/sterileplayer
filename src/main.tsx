import React from 'react'
import ReactDOM from 'react-dom/client'
import LarpMedia from './LarpMedia' // 1. Capitalized the import alias
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LarpMedia /> {/* 2. Capitalized the component tag */}
  </React.StrictMode>,
)
