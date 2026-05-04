'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

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
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? 'Connected' : 'Not connected'}
          </Badge>
          {lastSynced && (
            <span className="text-xs text-muted-foreground">
              Last synced: {new Date(lastSynced).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!isConnected ? (
            <Button size="sm" asChild>
              <a href="/api/tradestation/authorize">Connect TradeStation</a>
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
                {syncing ? 'Syncing…' : 'Sync Now'}
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </>
          )}
        </div>
      </div>
      {syncResult && (
        <div className={`text-sm rounded p-2 ${syncResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {syncResult.error
            ? `Error: ${syncResult.error}`
            : `Sync complete — ${syncResult.created} new, ${syncResult.updated} updated`}
        </div>
      )}
    </div>
  )
}
