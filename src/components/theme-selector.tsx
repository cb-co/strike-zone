'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { HugeiconsIcon } from '@hugeicons/react'
import { Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons'

const noop = () => () => {}

// Day/night concourse switch. The board stays dark either way; the hall dims around it.
export function ThemeSelector() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  const isNight = mounted && resolvedTheme === 'dark'

  return (
    <button
      type="button"
      onClick={() => setTheme(isNight ? 'light' : 'dark')}
      title={isNight ? 'Switch to day' : 'Switch to night'}
      aria-label={isNight ? 'Switch to day mode' : 'Switch to night mode'}
      className="w-full flex items-center gap-3 px-2 md:px-3 h-9 rounded-md text-[13px] font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors focus-visible:outline-2 focus-visible:outline-sidebar-ring"
    >
      <HugeiconsIcon icon={isNight ? Sun03Icon : Moon02Icon} size={18} className="shrink-0" />
      <span className="hidden md:block">{isNight ? 'Day mode' : 'Night mode'}</span>
    </button>
  )
}
