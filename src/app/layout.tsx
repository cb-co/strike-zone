import type { Metadata } from 'next'
import { Barlow, Barlow_Condensed, Barlow_Semi_Condensed } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import { ThemeProvider } from '@/components/theme-provider'
import { NavigationProgress } from '@/components/navigation-progress'

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
})
const barlowSemi = Barlow_Semi_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow-semi',
})
const barlowCond = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow-cond',
})

export const metadata: Metadata = {
  title: 'Strike Zone',
  description: 'Options income journal',
}

const DIRECTION_CONTRACT = `<!--
THESIS: Every option has a scheduled departure. Strike Zone is the station board that runs the book on time; it refuses the KPI-card trading dashboard.
OWN-WORLD: Pale enamel concourse, railway-blue wayfinding rail, one signal yellow for the action taken, a dark split-flap board as the only dark object in daylight. Barlow signage type, hinge-lined flap cells, station clock.
STORY: The trader sees what departs next, whether the book runs ahead of or behind its timetable, then logs, closes, or rolls.
FIRST VIEWPORT: Dashboard. A platform header with the session clock, then the departures board at full width: a totals line and open positions by expiration with DTE and status flaps. Add Trade (yellow) sits top-right.
FORM: Departure Hall, candidate 4 of 7, seed 76733c6a.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={cn('h-full antialiased', barlow.variable, barlowSemi.variable, barlowCond.variable)}
      suppressHydrationWarning
    >
      <body className="h-full">
        <div hidden dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
        <ThemeProvider>
          <NavigationProgress />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
