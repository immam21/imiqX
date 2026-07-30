'use client'

import { useEffect, useState, useCallback } from 'react'

// Module-level: persist across re-renders without triggering them
let deferredInstallPrompt: any = null

export default function PWAProvider() {
  const [showInstall, setShowInstall] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [tenantKey, setTenantKey] = useState('')

  // ── Service Worker registration ──────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Service worker in dev can cache stale Next chunks and trigger
    // runtime module factory mismatches (options.factory undefined).
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister())
      })
      return
    }

    const registerSW = async () => {
      try {
        // Determine tenant scope from cookie so each tenant gets its own SW registration
        const rawPrefix = document.cookie.split('; ').find((c) => c.startsWith('tenant_path_prefix='))?.split('=')[1]
        const tenantPrefix = decodeURIComponent(rawPrefix || '').trim()
        const swScope = (tenantPrefix && tenantPrefix !== '/') ? `${tenantPrefix}/` : '/'
        const slug = tenantPrefix && tenantPrefix !== '/' ? tenantPrefix.replace(/^\//,'').split('/')[0] : 'default'
        setTenantKey(slug)
        // Load per-tenant dismissed state
        const wasDismissed = localStorage.getItem(`pwa_dismissed:${slug}`) === '1'
        if (wasDismissed) setDismissed(true)
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: swScope })

        // Listen for a waiting worker (new version available)
        reg.addEventListener('updatefound', () => {
          const next = reg.installing
          if (!next) return
          next.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              setShowUpdate(true)
            }
          })
        })

        // Periodically check for updates (every 60 s)
        setInterval(() => reg.update(), 60_000)
      } catch (err) {
        console.warn('[PWA] SW registration failed:', err)
      }
    }

    registerSW()

    // When the active SW changes (after skip-waiting), reload all tabs
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })
  }, [])

  // ── Detect iOS / standalone ──────────────────────────────
  useEffect(() => {
    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
    setIsIOS(ios)
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true
    )
  }, [])

  // ── Install prompt (Chrome / Edge / Android) ─────────────
  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      deferredInstallPrompt = e
      setShowInstall(true)
    }
    const onInstalled = () => {
      setShowInstall(false)
      deferredInstallPrompt = null
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall as EventListener)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall as EventListener)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // ── Handlers ─────────────────────────────────────────────
  const handleInstall = useCallback(async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt()
      const { outcome } = await deferredInstallPrompt.userChoice
      if (outcome === 'accepted') {
        setShowInstall(false)
        deferredInstallPrompt = null
      }
      return
    }

    setShowInstallGuide(true)
  }, [])

  const handleDismiss = useCallback(() => {
    setDismissed(true)
    if (tenantKey) localStorage.setItem(`pwa_dismissed:${tenantKey}`, '1')
  }, [tenantKey])

  const handleUpdate = useCallback(() => {
    setShowUpdate(false)
    // Tell the waiting SW to activate
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' })
    })
  }, [])

  // Don't render anything if already installed or dismissed
  const showIOSHint = isIOS && !isStandalone && !dismissed

  return (
    <>
      {/* ── Floating Install CTA (above WhatsApp FAB) ─────── */}
      {!isStandalone && !dismissed && (
        <button
          onClick={handleInstall}
          aria-label="Install app"
          title="Install app"
          className="fixed bottom-24 right-4 z-[58] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-700 text-white shadow-lg shadow-blue-600/35 transition-all hover:scale-110 hover:shadow-xl hover:shadow-blue-600/40 sm:right-6"
        >
          <span className="pointer-events-none absolute -top-1.5 -right-1.5 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-accent ring-1 ring-blue-200">
            App
          </span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v11" />
            <path d="M8 10l4 4 4-4" />
            <path d="M4 20h16" />
          </svg>
        </button>
      )}

      {/* ── Manual install help card ───────────────────────── */}
      {showInstallGuide && !isStandalone && (
        <div
          role="dialog"
          aria-label="Install help"
          className="fixed bottom-[130px] right-4 z-[60] w-72 animate-pop sm:right-6"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
            <div className="flex items-center gap-3 bg-gradient-to-r from-accent to-blue-600 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2v13M19 9l-7 7-7-7" />
                  <path d="M5 21h14" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Install App</p>
                <p className="text-sm font-bold text-white">Add to home screen</p>
              </div>
            </div>
            <div className="p-4">
              {isIOS ? (
                <p className="text-xs leading-5 text-slate-500">
                  On Safari, tap Share and choose Add to Home Screen.
                </p>
              ) : (
                <p className="text-xs leading-5 text-slate-500">
                  If no prompt appears, open browser menu and select Install App or Add to Home Screen.
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setShowInstallGuide(false)}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  onClick={() => { setShowInstallGuide(false); handleDismiss() }}
                  className="rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-black"
                >
                  Hide
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Chrome/Android Install Prompt ────────────────── */}
      {showInstall && !dismissed && !isStandalone && (
        <div
          role="dialog"
          aria-label="Install app"
          className="fixed bottom-[84px] right-4 z-[60] w-72 animate-pop sm:bottom-6"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
            {/* Header */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-accent to-blue-600 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2v13M19 9l-7 7-7-7" />
                  <path d="M5 21h14" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">Install App</p>
                <p className="text-sm font-bold text-white">Add to home screen</p>
              </div>
            </div>
            {/* Body */}
            <div className="p-4">
              <p className="text-xs leading-5 text-slate-500">
                Get a faster, app-like experience with offline access and no browser chrome.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleInstall}
                  className="flex-1 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Install the app"
                >
                  Install
                </button>
                <button
                  onClick={handleDismiss}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  aria-label="Dismiss install prompt"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── iOS Safari Hint ──────────────────────────────── */}
      {showIOSHint && (
        <div
          role="dialog"
          aria-label="Install on iOS"
          className="fixed bottom-4 inset-x-4 z-[60] animate-pop"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
            <div className="flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2v13M19 9l-7 7-7-7" />
                  <path d="M5 21h14" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">Install on iPhone</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Tap the{' '}
                  <svg className="inline h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Share button">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>{' '}
                  Share button, then <strong>"Add to Home Screen"</strong>.
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="shrink-0 text-slate-400 transition hover:text-slate-600 focus:outline-none"
                aria-label="Dismiss">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Update Available Banner ───────────────────────── */}
      {showUpdate && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed inset-x-4 top-[100px] z-[60] animate-fade-up sm:inset-x-auto sm:right-4 sm:w-80"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
            <div className="flex items-start gap-3 p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">Update available</p>
                <p className="mt-0.5 text-xs text-slate-500">A new version is ready to install.</p>
                <button
                  onClick={handleUpdate}
                  className="mt-2.5 w-full rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Update the app now"
                >
                  Update now
                </button>
              </div>
              <button
                onClick={() => setShowUpdate(false)}
                className="shrink-0 text-slate-400 transition hover:text-slate-600 focus:outline-none"
                aria-label="Dismiss update notification"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
