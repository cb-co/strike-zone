import {
  DashboardSquare01Icon,
  ChartBarLineIcon,
  Target01Icon,
  Calendar01Icon,
  Wallet01Icon,
  Settings01Icon,
  Layers01Icon,
} from '@hugeicons/core-free-icons'

// One pictogram per destination, shared by the wayfinding rail and each page's sign.
export const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: DashboardSquare01Icon },
  { href: '/trades', label: 'Trades', icon: ChartBarLineIcon },
  { href: '/goals', label: 'Goals', icon: Target01Icon },
  { href: '/monthly', label: 'Monthly', icon: Calendar01Icon },
  { href: '/accounts', label: 'Accounts', icon: Wallet01Icon },
  { href: '/system', label: 'System', icon: Settings01Icon },
] as const

export const PAGE_ICONS = {
  dashboard: DashboardSquare01Icon,
  trades: ChartBarLineIcon,
  goals: Target01Icon,
  monthly: Calendar01Icon,
  accounts: Wallet01Icon,
  system: Settings01Icon,
  instruments: Layers01Icon,
} as const
