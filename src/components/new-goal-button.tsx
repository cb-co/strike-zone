'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createGoal } from '@/actions/goals'

type Props = { accounts: { id: string; name: string }[] }

export function NewGoalButton({ accounts }: Props) {
  const [open, setOpen] = useState(false)
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>New Goal</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Goal</DialogTitle></DialogHeader>
        <form action={(fd) => { fd.set('accountId', accountId); return createGoal(fd).then(() => setOpen(false)) }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="year">Year</Label>
              <Input id="year" name="year" type="number" defaultValue={new Date().getFullYear()} required />
            </div>
            <div className="space-y-1">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="goalAmount">Goal Amount ($)</Label>
              <Input id="goalAmount" name="goalAmount" type="number" step="any" placeholder="50000" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="curveFactor">Curve Factor</Label>
              <Input id="curveFactor" name="curveFactor" type="number" step="0.1" defaultValue="1.0" placeholder="1.0 = linear" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="monthlyFixedWd">Fixed WD/mo ($)</Label>
              <Input id="monthlyFixedWd" name="monthlyFixedWd" type="number" step="any" defaultValue="0" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="monthlyVariableWdPct">Variable WD % (0.1 = 10%)</Label>
              <Input id="monthlyVariableWdPct" name="monthlyVariableWdPct" type="number" step="0.01" defaultValue="0" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create Goal</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
