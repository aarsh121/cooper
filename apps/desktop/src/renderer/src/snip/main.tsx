import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SnipApp from './SnipApp'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SnipApp />
  </StrictMode>
)
