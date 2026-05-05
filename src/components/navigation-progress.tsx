'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

export function NavigationProgress() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const prevPathname = useRef(pathname)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      // Navigation completed — finish the bar
      setWidth(100)
      timerRef.current = setTimeout(() => setVisible(false), 300)
      prevPathname.current = pathname
    }
  }, [pathname])

  // Start progress when a link is clicked
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('http') || anchor.target === '_blank') return

      if (timerRef.current) clearTimeout(timerRef.current)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)

      setWidth(0)
      setVisible(true)

      // Animate to ~80% quickly, then slow down
      let w = 0
      function step() {
        w = w < 30 ? w + 6 : w < 60 ? w + 2 : w < 80 ? w + 0.5 : w
        setWidth(Math.min(w, 82))
        if (w < 82) rafRef.current = requestAnimationFrame(step)
      }
      rafRef.current = requestAnimationFrame(step)
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-0.5 bg-primary transition-all duration-200 ease-out"
      style={{ width: `${width}%`, opacity: visible ? 1 : 0 }}
    />
  )
}
