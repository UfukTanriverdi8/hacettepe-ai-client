import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
// Imported here rather than @import-ed from index.css: Tailwind's PostCSS plugin inlines an
// @import but leaves its relative url()s pointing at files Vite never copies, so the fonts 404.
// Only the latin and latin-ext files are fetched, picked by each @font-face's unicode-range.
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import "./index.css"


// index.html always has #root, so the non-null assertion cannot fail.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
