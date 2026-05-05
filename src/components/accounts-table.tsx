'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createAccount, updateAccount, deleteAccount, setMainAccount } from '@/actions/accounts'
type Account = {
  id: string
  name: string
  broker: string
  description: string | null
  isActive: boolean
  isMain: boolean
  startingBalance: number
  currentBalance: number
  commissionPerOption: number
  commissionPerStock: number
  optionAssignmentFee: number
}

function AccountForm({ account, onDone }: { account?: Account; onDone: () => void }) {
  const action = account
    ? (fd: FormData) => updateAccount(account.id, fd).then(onDone)
    : (fd: FormData) => createAccount(fd).then(onDone)

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={account?.name} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="broker">Broker</Label>
          <Input id="broker" name="broker" defaultValue={account?.broker} required />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" defaultValue={account?.description ?? ''} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="startingBalance">Starting Balance ($)</Label>
          <Input id="startingBalance" name="startingBalance" type="number" step="0.01" defaultValue={String(account?.startingBalance ?? 0)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="commissionPerOption">Commission / Option ($)</Label>
          <Input id="commissionPerOption" name="commissionPerOption" type="number" step="0.01" defaultValue={String(account?.commissionPerOption ?? 0)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="commissionPerStock">Commission / Stock ($)</Label>
          <Input id="commissionPerStock" name="commissionPerStock" type="number" step="0.01" defaultValue={String(account?.commissionPerStock ?? 0)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="optionAssignmentFee">Option Assignment Fee ($)</Label>
          <Input id="optionAssignmentFee" name="optionAssignmentFee" type="number" step="0.01" defaultValue={String(account?.optionAssignmentFee ?? 0)} />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" name="isMain" value="true" defaultChecked={account?.isMain} className="rounded" />
          Set as main account
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" name="isActive" value="true" defaultChecked={account?.isActive ?? true} className="rounded" />
          Active
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit">{account ? 'Save' : 'Create'}</Button>
      </div>
    </form>
  )
}

export function AccountsTable({ accounts }: { accounts: Account[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>Add Account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
            <AccountForm onDone={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Broker</th>
              <th className="px-4 py-3 text-right font-medium">Starting</th>
              <th className="px-4 py-3 text-right font-medium">Current</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="px-4 py-3 font-medium">{account.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{account.broker}</td>
                <td className="px-4 py-3 text-right">${Number(account.startingBalance).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">
                  ${account.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {account.isMain && <Badge variant="default">Main</Badge>}
                    {account.isActive && <Badge variant="secondary">Active</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {!account.isMain && (
                      <Button size="sm" variant="outline" onClick={() => setMainAccount(account.id)}>
                        Set Main
                      </Button>
                    )}
                    <Dialog open={editingId === account.id} onOpenChange={(o) => setEditingId(o ? account.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">Edit</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
                        <AccountForm account={account} onDone={() => setEditingId(null)} />
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="destructive" onClick={() => deleteAccount(account.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No accounts yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
