// main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createClient } from '@supabase/supabase-js'
import './index.css'
import App from './App.jsx'

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
if (supabaseUrl && supabaseKey) {
  window.supabase = createClient(supabaseUrl, supabaseKey)
} else {
  console.warn('Supabase credentials missing – uploads will fallback to local')
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)