import { HugeiconsIcon } from '@hugeicons/react'
import { PAGE_ICONS } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { SessionSign } from '@/components/session-clock'

type Props = {
  page: keyof typeof PAGE_ICONS
  title: string
  meta?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

// Platform sign: an enamel pictogram square beside the destination name.
export function PageHeader({ page, title, meta, actions, className }: Props) {
  return (
    <header className={cn('flex flex-wrap items-center justify-between gap-x-6 gap-y-3', className)}>
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden
          className="grid place-items-center size-9 shrink-0 rounded-md bg-sidebar text-sidebar-foreground dark:bg-sidebar-accent"
        >
          <HugeiconsIcon icon={PAGE_ICONS[page]} size={20} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex items-baseline gap-3 flex-wrap">
          <h1 className="text-[1.625rem] leading-none font-semibold tracking-[-0.01em]">{title}</h1>
          {meta && <div className="text-[13px] text-muted-foreground">{meta}</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="hidden sm:block"><SessionSign /></div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

// Section heading inside a page: a real step below the page title.
export function SectionTitle({ children, aside, className }: { children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', className)}>
      <h2 className="text-[17px] leading-tight font-semibold">{children}</h2>
      {aside && <div className="text-[13px] text-muted-foreground">{aside}</div>}
    </div>
  )
}
