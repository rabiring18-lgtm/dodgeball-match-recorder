const OFFLINE_READY_KEY = 'dodgeballMatchRecorder.offlineReadyNotified'

function dispatchPwaEvent(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

function notifyOfflineReadyOnce() {
  try {
    if (window.localStorage.getItem(OFFLINE_READY_KEY) === 'true') return
    window.localStorage.setItem(OFFLINE_READY_KEY, 'true')
  } catch {
    return
  }
  dispatchPwaEvent('rocks-pwa-ready')
}

function collectCacheableUrls() {
  const urls = new Set([window.location.href])
  const sameOrigin = (url) => {
    try {
      return new URL(url, window.location.href).origin === window.location.origin
    } catch {
      return false
    }
  }

  performance
    .getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter(sameOrigin)
    .forEach((url) => urls.add(url))

  return [...urls]
}

function sendRuntimeCacheUrls(registration) {
  if (!registration.active) return
  registration.active.postMessage({
    type: 'CACHE_URLS',
    urls: collectCacheableUrls(),
  })
}

export function registerPwa() {
  if (!('serviceWorker' in navigator)) return

  const baseUrl = import.meta.env.BASE_URL || '/'
  const serviceWorkerUrl = `${baseUrl}sw.js`
  const hadController = Boolean(navigator.serviceWorker.controller)
  let refreshing = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) return
    window.location.reload()
  })

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
        scope: baseUrl,
      })

      window.__ROCKS_PWA_REGISTRATION__ = registration

      navigator.serviceWorker.ready.then((readyRegistration) => {
        sendRuntimeCacheUrls(readyRegistration)
      })

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state !== 'installed') return

          if (navigator.serviceWorker.controller || hadController) {
            dispatchPwaEvent('rocks-pwa-update', { registration })
          } else {
            notifyOfflineReadyOnce()
          }
        })
      })

      window.addEventListener('rocks-pwa-apply-update', () => {
        const waitingWorker = registration.waiting || registration.installing
        if (!waitingWorker) return
        refreshing = true
        waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      })

      if (registration.waiting && navigator.serviceWorker.controller) {
        dispatchPwaEvent('rocks-pwa-update', { registration })
      }
    } catch (error) {
      console.warn('PWA registration failed', error)
    }
  })
}
