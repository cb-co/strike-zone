'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  DashboardSquare01Icon,
  ChartBarLineIcon,
  Target01Icon,
  Calendar01Icon,
  Wallet01Icon,
  AnalyticsUpIcon,
  Settings01Icon,
  Logout01Icon,
  Moon01Icon,
  Sun01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: DashboardSquare01Icon },
  { href: '/trades', label: 'Trades', icon: ChartBarLineIcon },
  { href: '/goals', label: 'Goals', icon: Target01Icon },
  { href: '/monthly', label: 'Monthly', icon: Calendar01Icon },
  { href: '/accounts', label: 'Accounts', icon: Wallet01Icon },
  { href: '/instruments', label: 'Instruments', icon: AnalyticsUpIcon },
  { href: '/system', label: 'System', icon: Settings01Icon },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-14 md:w-56 shrink-0 border-r bg-sidebar flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center px-3 md:px-4 py-5 border-b min-h-[64px]">
        <span className="hidden md:block font-semibold text-lg tracking-tight">Strike Zone</span>
        <HugeiconsIcon icon={ChartBarLineIcon} size={20} className="md:hidden text-sidebar-foreground" />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              'flex items-center gap-2.5 px-2 md:px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <HugeiconsIcon icon={icon} size={18} className="shrink-0" />
            <span className="hidden md:block">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="p-2 border-t space-y-1">
        {mounted && (
          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            title={resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="w-full flex items-center gap-2.5 px-2 md:px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            <HugeiconsIcon icon={resolvedTheme === 'dark' ? Sun01Icon : Moon01Icon} size={18} className="shrink-0" />
            <span className="hidden md:block">{resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        )}
        <button
          onClick={signOut}
          title="Sign out"
          className="w-full flex items-center gap-2.5 px-2 md:px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <HugeiconsIcon icon={Logout01Icon} size={18} className="shrink-0" />
          <span className="hidden md:block">Sign out</span>
        </button>
      </div>
    </aside>
  )
}
