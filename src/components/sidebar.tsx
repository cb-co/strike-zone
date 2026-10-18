'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Logout01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { ThemeSelector } from '@/components/theme-selector'
import { NAV_ITEMS } from '@/lib/nav'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-14 md:w-60 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col h-full">
      {/* Station name board */}
      <div className="px-2.5 md:px-4 h-[76px] flex items-center border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-sidebar-ring" aria-label="Strike Zone home">
          <span aria-hidden className="grid place-items-center size-9 md:size-8 shrink-0 rounded-sm bg-sidebar-foreground text-sidebar font-heading font-bold text-[15px] tracking-tight">
            SZ
          </span>
          <span className="hidden md:block font-heading font-semibold text-[19px] tracking-[-0.005em] leading-none">
            Strike Zone
          </span>
        </Link>
      </div>

      {/* Destinations */}
      <nav aria-label="Main" className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-2 md:px-3 h-10 rounded-md text-[14px] font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-sidebar-ring',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/75 hover:text-sidebar-foreground hover:bg-sidebar-accent/60',
              )}
            >
              <HugeiconsIcon
                icon={icon}
                size={19}
                strokeWidth={active ? 2 : 1.6}
                className="shrink-0 ml-0.5"
              />
              <span className="hidden md:block">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        <ThemeSelector />
        <button
          onClick={signOut}
          title="Sign out"
          className="w-full flex items-center gap-3 px-2 md:px-3 h-9 rounded-md text-[13px] font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors focus-visible:outline-2 focus-visible:outline-sidebar-ring"
        >
          <HugeiconsIcon icon={Logout01Icon} size={18} className="shrink-0" />
          <span className="hidden md:block">Sign out</span>
        </button>
      </div>
    </aside>
  )
}
