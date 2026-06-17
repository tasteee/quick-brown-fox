import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

// A perfectly normal React entry point. No Electron imports anywhere — just
// run it with `qbf dev` and it opens in a desktop window.
const root = document.getElementById('root')!
createRoot(root).render(<App />)
