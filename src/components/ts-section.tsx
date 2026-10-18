'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  isConnected: boolean
  lastSynced: Date | null
}

export function TSSection({ isConnected, lastSynced }: Props) {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ created?: number; updated?: number; error?: string } | null>(null)

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/tradestation/sync', { method: 'POST' })
      const data = await res.json() as { created?: number; updated?: number; error?: string }
      setSyncResult(data)
    } catch {
      setSyncResult({ error: 'Network error' })
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    await fetch('/api/tradestation/disconnect', { method: 'POST' })
    window.location.reload()
  }

  return (
    <div className="rounded-lg ring-1 ring-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className={`size-2.5 rounded-full ${isConnected ? 'bg-gain shadow-[0_0_0_3px_color-mix(in_oklch,var(--gain)_20%,transparent)]' : 'bg-muted-foreground/40'}`}
            />
            <span className="text-[14px] font-semibold">{isConnected ? 'Connected to TradeStation' : 'Not connected'}</span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            {isConnected
              ? lastSynced
                ? `Last synced ${new Date(lastSynced).toLocaleString()}`
                : 'Connected, not synced yet'
              : 'Connect once and sync to pull trades straight from your TradeStation account.'}
          </p>
        </div>
        <div className="flex gap-2">
          {!isConnected ? (
            <Button size="sm" asChild>
              <a href="/api/tradestation/authorize">Connect TradeStation</a>
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync now'}
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </>
          )}
        </div>
      </div>
      {syncResult && (
        <div role="status" className={`text-[13px] rounded-md px-3 py-2 ${syncResult.error ? 'bg-loss-soft text-loss' : 'bg-gain-soft text-gain'}`}>
          {syncResult.error
            ? `Sync failed: ${syncResult.error}. Try again, or reconnect if it keeps failing.`
            : `Sync complete: ${syncResult.created} new, ${syncResult.updated} updated.`}
        </div>
      )}
    </div>
  )
}
