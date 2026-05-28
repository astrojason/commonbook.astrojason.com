export function setupServiceWorker(): void {
  if (!navigator.serviceWorker) return

  const register = () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(err => console.warn('[SW] Registration failed:', err))
  }

  if (document.readyState === 'complete') {
    register()
  } else {
    window.addEventListener('load', register, { once: true })
  }
}
