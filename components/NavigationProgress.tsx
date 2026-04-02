'use client'
/**
 * NavigationProgress — thin indigo bar at the top of the screen.
 *
 * How it works:
 * - Sidebar links dispatch a custom 'nav-start' event on click
 * - This component listens, immediately shows the bar + animates to ~70%
 * - When usePathname() changes (navigation complete), it snaps to 100% then hides
 *
 * No package needed. Zero dependencies beyond Next.js.
 */
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationProgress() {
  const pathname   = usePathname()
  const prevPath   = useRef(pathname)
  const [pct, setPct]       = useState(0)
  const [visible, setVisible] = useState(false)
  const timer      = useRef<ReturnType<typeof setTimeout>>()

  // Listen for nav-start from Sidebar
  useEffect(() => {
    function start() {
      clearTimeout(timer.current)
      setVisible(true)
      setPct(15)
      // Crawl to 70% while waiting for server
      timer.current = setTimeout(() => setPct(70), 150)
    }
    window.addEventListener('nav-start', start)
    return () => window.removeEventListener('nav-start', start)
  }, [])

  // Complete when pathname actually changes
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname
      clearTimeout(timer.current)
      setPct(100)
      timer.current = setTimeout(() => {
        setVisible(false)
        setPct(0)
      }, 300)
    }
  }, [pathname])

  if (!visible) return null

  return (
    <div
      style={{
        position:  'fixed',
        top:       0,
        left:      0,
        right:     0,
        height:    '2px',
        zIndex:    9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height:     '100%',
          width:      `${pct}%`,
          background: 'linear-gradient(90deg, #6366f1, #0ea5e9)',
          boxShadow:  '0 0 8px rgba(99,102,241,0.7)',
          transition: pct === 100
            ? 'width 0.15s ease'
            : pct === 70
              ? 'width 2s ease-out'
              : 'width 0.1s ease',
        }}
      />
    </div>
  )
}
