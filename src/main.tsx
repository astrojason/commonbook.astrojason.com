import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupServiceWorker } from './registerSW'

// Purge SW caches that were incorrectly caching Firestore/API responses.
// These caches poison the Firestore transport, causing silent write failures.
if ('caches' in window) {
  void Promise.all([
    caches.delete('firestore'),
    caches.delete('firebase-auth'),
    caches.delete('api-calls'),
  ])
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

setupServiceWorker()
