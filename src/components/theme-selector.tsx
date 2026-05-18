'use client'

import { useTheme } from 'next-themes'
import { usePalette, PALETTES, type Palette } from '@/lib/palette'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HugeiconsIcon } from '@hugeicons/react'
import { Moon01Icon, Sun01Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

const PALETTE_CONFIG: Record<Palette, { label: string; lightColor: string; darkColor: string }> = {
  default:  { label: 'Default',          lightColor: '#71717a', darkColor: '#a1a1aa' },
  winter:   { label: 'Winter is Coming', lightColor: '#4a7fa8', darkColor: '#6ab0e3' },
  terminal: { label: 'Terminal',         lightColor: '#16a34a', darkColor: '#4ade80' },
  warm:     { label: 'Warm',             lightColor: '#d97706', darkColor: '#f59e0b' },
  purple:   { label: 'Purple',           lightColor: '#7c3aed', darkColor: '#a78bfa' },
}

export function ThemeSelector() {
  const { palette, setPalette } = usePalette()
  const { resolvedTheme, setTheme } = useTheme()

  // resolvedTheme is undefined before hydration — default to dark to match defaultTheme="dark"
  // so server and client render the same structure and avoid hydration mismatch
  const isDark = resolvedTheme !== 'light'
  const config = PALETTE_CONFIG[palette]
  const dotColor = isDark ? config.darkColor : config.lightColor

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title="Theme"
          className="w-full flex items-center gap-2.5 px-2 md:px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <span
            className="shrink-0 w-[18px] h-[18px] rounded-full border border-sidebar-foreground/20"
            style={{ backgroundColor: dotColor }}
            suppressHydrationWarning
          />
          <span className="hidden md:block">Theme</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-48">
        {PALETTES.map((p) => {
          const cfg = PALETTE_CONFIG[p]
          const color = isDark ? cfg.darkColor : cfg.lightColor
          return (
            <DropdownMenuItem
              key={p}
              onClick={() => setPalette(p)}
              className={cn('flex items-center gap-2.5 cursor-pointer', palette === p && 'font-medium')}
            >
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                style={{ backgroundColor: color }}
              />
              <span className="flex-1">{cfg.label}</span>
              {palette === p && <span className="text-xs opacity-60">✓</span>}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <HugeiconsIcon icon={isDark ? Sun01Icon : Moon01Icon} size={14} className="shrink-0" />
          {isDark ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
