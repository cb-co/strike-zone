'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-56 shrink-0 border-r bg-sidebar flex flex-col h-full">
      <div className="px-4 py-5 border-b">
        <span className="font-semibold text-lg tracking-tight">Strike Zone</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {navItems.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
          >
            <HugeiconsIcon icon={icon} size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-2 border-t space-y-1">
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <HugeiconsIcon icon={resolvedTheme === 'dark' ? Sun01Icon : Moon01Icon} size={18} />
          {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <HugeiconsIcon icon={Logout01Icon} size={18} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
