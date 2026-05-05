'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TradeForm } from '@/components/trade-form'

type Props = {
  accounts: { id: string; name: string }[]
  setups: { id: string; name: string }[]
  instruments: { id: string; ticker: string; name: string }[]
}

export function AddTradeButton({ accounts, setups, instruments }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Trade</Button>
      <TradeForm open={open} onOpenChange={setOpen} accounts={accounts} setups={setups} instruments={instruments} />
    </>
  )
}
