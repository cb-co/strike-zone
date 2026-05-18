'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react'

export const PALETTES = ['default', 'winter', 'terminal', 'warm', 'purple'] as const
export type Palette = (typeof PALETTES)[number]

const STORAGE_KEY = 'strike-zone-palette'

// Module-level store so all provider instances share the same subscription
const subscribers = new Set<() => void>()

function subscribe(cb: () => void) {
  subscribers.add(cb)
  return () => { subscribers.delete(cb) }
}

function getSnapshot(): Palette {
  const stored = localStorage.getItem(STORAGE_KEY) as Palette | null
  return stored && (PALETTES as readonly string[]).includes(stored) ? stored : 'default'
}

function getServerSnapshot(): Palette {
  return 'default'
}

function applyPalette(p: Palette) {
  const html = document.documentElement
  for (const name of PALETTES) {
    if (name !== 'default') html.classList.remove(`palette-${name}`)
  }
  if (p !== 'default') html.classList.add(`palette-${p}`)
}

type PaletteContextValue = {
  palette: Palette
  setPalette: (p: Palette) => void
}

const PaletteContext = createContext<PaletteContextValue>({
  palette: 'default',
  setPalette: () => {},
})

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const palette = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    applyPalette(palette)
  }, [palette])

  const setPalette = useCallback((p: Palette) => {
    localStorage.setItem(STORAGE_KEY, p)
    applyPalette(p)
    subscribers.forEach(fn => fn())
  }, [])

  const value = useMemo(() => ({ palette, setPalette }), [palette, setPalette])

  return (
    <PaletteContext.Provider value={value}>
      {children}
    </PaletteContext.Provider>
  )
}

export function usePalette() {
  return useContext(PaletteContext)
}
