import type { Metadata } from 'next'
import { Geist_Mono, Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { cn } from '@/lib/utils'
import { ThemeProvider } from '@/components/theme-provider'
import { NavigationProgress } from '@/components/navigation-progress'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Strike Zone',
  description: 'Personal trading tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('h-full antialiased', inter.variable, geistMono.variable)} suppressHydrationWarning>
      <body className="h-full">
        <Script
          id="palette-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=localStorage.getItem('strike-zone-palette');var v=['winter','terminal','warm','purple'];if(p&&v.indexOf(p)!==-1)document.documentElement.classList.add('palette-'+p);}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <NavigationProgress />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
