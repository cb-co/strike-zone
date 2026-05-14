'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TradeForm } from '@/components/trade-form'

type Props = {
  accounts: { id: string; name: string }[]
  setups: { id: string; name: string }[]
}

export function AddTradeButton({ accounts, setups }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Trade</Button>
      <TradeForm key={open ? 'open' : 'closed'} open={open} onOpenChange={setOpen} accounts={accounts} setups={setups} />
    </>
  )
}
