'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createInstrument, updateInstrument, deleteInstrument } from '@/actions/instruments'

type Instrument = {
  id: string
  ticker: string
  name: string
  type: 'ETF' | 'STOCK' | 'CRYPTO'
  description: string | null
}

function InstrumentForm({ instrument, onDone }: { instrument?: Instrument; onDone: () => void }) {
  const [type, setType] = useState<string>(instrument?.type ?? 'ETF')

  async function handleSubmit(fd: FormData) {
    fd.set('type', type)
    if (instrument) await updateInstrument(instrument.id, fd)
    else await createInstrument(fd)
    onDone()
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="ticker">Ticker</Label>
          <Input id="ticker" name="ticker" defaultValue={instrument?.ticker} placeholder="SOXL" required />
        </div>
        <div className="space-y-1">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ETF">ETF</SelectItem>
              <SelectItem value="STOCK">Stock</SelectItem>
              <SelectItem value="CRYPTO">Crypto</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={instrument?.name} required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" defaultValue={instrument?.description ?? ''} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit">{instrument ? 'Save' : 'Create'}</Button>
      </div>
    </form>
  )
}

const typeColors: Record<string, 'default' | 'secondary' | 'outline'> = {
  ETF: 'default', STOCK: 'secondary', CRYPTO: 'outline',
}

export function InstrumentsTable({ instruments }: { instruments: Instrument[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button>Add Instrument</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Instrument</DialogTitle></DialogHeader>
            <InstrumentForm onDone={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Ticker</th>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Description</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {instruments.map((inst) => (
              <tr key={inst.id}>
                <td className="px-4 py-3 font-mono font-medium">{inst.ticker}</td>
                <td className="px-4 py-3">{inst.name}</td>
                <td className="px-4 py-3"><Badge variant={typeColors[inst.type]}>{inst.type}</Badge></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{inst.description}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Dialog open={editingId === inst.id} onOpenChange={(o) => setEditingId(o ? inst.id : null)}>
                      <DialogTrigger asChild><Button size="sm" variant="outline">Edit</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Edit Instrument</DialogTitle></DialogHeader>
                        <InstrumentForm instrument={inst} onDone={() => setEditingId(null)} />
                      </DialogContent>
                    </Dialog>
                    <Button size="sm" variant="destructive" onClick={() => deleteInstrument(inst.id)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
            {instruments.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No instruments yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
