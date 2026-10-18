'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Flap } from '@/components/flap'
import { SessionSign } from '@/components/session-clock'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] bg-background">
      {/* The hall's name board */}
      <div className="bg-sidebar text-sidebar-foreground flex flex-col justify-between gap-10 px-6 py-8 md:px-12 md:py-12">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid place-items-center size-10 rounded-sm bg-sidebar-foreground text-sidebar font-heading font-bold text-[17px]">
            SZ
          </span>
          <span className="font-heading font-semibold text-[22px] tracking-[-0.005em]">Strike Zone</span>
        </div>

        <div className="space-y-5">
          <div className="board inline-flex flex-col gap-1.5 p-3 md:p-4">
            <Flap value="STRIKE ZONE" cells={11} size="lg" tone="yellow" />
            <Flap value="OPTIONS DESK" cells={11} size="lg" />
          </div>
          <p className="max-w-sm text-[15px] text-sidebar-foreground/80">
            Your options income journal. Every position has a departure time; keep the book on schedule.
          </p>
        </div>

        <div><SessionSign /></div>
      </div>

      {/* Sign-in */}
      <div className="flex items-center justify-center px-6 py-12">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6" aria-describedby={error ? 'login-error' : undefined}>
          <div className="space-y-1.5">
            <h1 className="text-[28px] leading-tight font-semibold">Sign in</h1>
            <p className="text-[14px] text-muted-foreground">Use the email and password for your Strike Zone account.</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 text-[14px]"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 text-[14px]"
                required
              />
            </div>
          </div>
          {error && (
            <p id="login-error" role="alert" className="rounded-md bg-loss-soft px-3 py-2 text-[13px] text-loss">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
