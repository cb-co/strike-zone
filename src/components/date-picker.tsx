'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Calendar01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Props = {
  name: string
  /** Controlled YYYY-MM-DD value — takes priority over defaultValue */
  value?: string
  onValueChange?: (v: string) => void
  defaultValue?: string
  placeholder?: string
  className?: string
}

export function DatePicker({ name, value, onValueChange, defaultValue, placeholder = 'Pick a date', className }: Props) {
  const toDate = (s: string | undefined) => (s ? parseISO(s) : undefined)

  const [internal, setInternal] = useState<Date | undefined>(toDate(defaultValue))

  const isControlled = value !== undefined
  const selected = isControlled ? toDate(value) : internal

  function handleSelect(d: Date | undefined) {
    const iso = d ? format(d, 'yyyy-MM-dd') : ''
    if (!isControlled) setInternal(d)
    onValueChange?.(iso)
  }

  return (
    <>
      <input type="hidden" name={name} value={selected ? format(selected, 'yyyy-MM-dd') : ''} />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn('w-full justify-start text-left font-normal', !selected && 'text-muted-foreground', className)}
          >
            <HugeiconsIcon icon={Calendar01Icon} size={15} className="mr-2 shrink-0" />
            {selected ? format(selected, 'MMM d, yyyy') : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={selected} onSelect={handleSelect} autoFocus />
        </PopoverContent>
      </Popover>
    </>
  )
}
