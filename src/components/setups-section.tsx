'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSetup, updateSetup, deleteSetup } from '@/actions/setups'

type Setup = { id: string; name: string; description: string | null }

function SetupForm({ setup, onDone }: { setup?: Setup; onDone: () => void }) {
  const action = setup
    ? (fd: FormData) => updateSetup(setup.id, fd).then(onDone)
    : (fd: FormData) => createSetup(fd).then(onDone)

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={setup?.name} placeholder="wheel, buy-dip…" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" defaultValue={setup?.description ?? ''} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit">{setup ? 'Save' : 'Create'}</Button>
      </div>
    </form>
  )
}

export function SetupsSection({ setups }: { setups: Setup[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button size="sm">Add Setup</Button></DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader><DialogTitle>New Setup</DialogTitle></DialogHeader>
            <SetupForm onDone={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="divide-y rounded-md border">
        {setups.map((setup) => (
          <div key={setup.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{setup.name}</p>
              {setup.description && <p className="text-xs text-muted-foreground">{setup.description}</p>}
            </div>
            <div className="flex gap-2">
              <Dialog open={editingId === setup.id} onOpenChange={(o) => setEditingId(o ? setup.id : null)}>
                <DialogTrigger asChild><Button size="sm" variant="outline">Edit</Button></DialogTrigger>
                <DialogContent aria-describedby={undefined}>
                  <DialogHeader><DialogTitle>Edit Setup</DialogTitle></DialogHeader>
                  <SetupForm setup={setup} onDone={() => setEditingId(null)} />
                </DialogContent>
              </Dialog>
              <Button size="sm" variant="destructive" onClick={() => deleteSetup(setup.id)}>Delete</Button>
            </div>
          </div>
        ))}
        {setups.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No setups yet</p>
        )}
      </div>
    </div>
  )
}
