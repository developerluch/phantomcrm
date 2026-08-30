import { useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { IconPlus, IconCheck, IconX } from '@tabler/icons-react'
import { useContactTags } from '@/hooks/useContacts'

interface TagPickerProps {
  selected: string[]
  onToggle: (tag: string) => void
  onCreate?: (tag: string) => void
  trigger?: React.ReactNode
  align?: 'start' | 'center' | 'end'
}

export function TagPicker({ selected, onToggle, onCreate, trigger, align = 'start' }: TagPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { data: tags } = useContactTags()

  const all = tags?.map((t) => t.tag) ?? []
  const filtered = query
    ? all.filter((t) => t.toLowerCase().includes(query.toLowerCase()))
    : all
  const queryExactMatch = filtered.some((t) => t.toLowerCase() === query.toLowerCase())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <IconPlus size={14} className="mr-1" /> Tags
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder="Find or create tag…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup heading="Tags">
              {filtered.map((tag) => {
                const isSelected = selected.includes(tag)
                return (
                  <CommandItem key={tag} onSelect={() => onToggle(tag)}>
                    <span className="flex-1">{tag}</span>
                    {isSelected ? (
                      <IconCheck size={14} className="text-accent-foreground" />
                    ) : null}
                  </CommandItem>
                )
              })}
              {query && !queryExactMatch && onCreate && (
                <CommandItem
                  onSelect={() => {
                    onCreate(query)
                    setQuery('')
                  }}
                >
                  <IconPlus size={14} className="mr-2" />
                  Create &ldquo;{query}&rdquo;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Compact chip list with remove buttons. Used inside drawer tabs + bulk bar. */
export function TagChips({
  tags,
  onRemove,
  max,
}: {
  tags: string[]
  onRemove?: (tag: string) => void
  max?: number
}) {
  const visible = max && tags.length > max ? tags.slice(0, max) : tags
  const hidden = max && tags.length > max ? tags.length - max : 0
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1">
          {tag}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-3 w-3 p-0 opacity-60 hover:opacity-100"
              onClick={() => onRemove(tag)}
            >
              <IconX size={10} />
            </Button>
          )}
        </Badge>
      ))}
      {hidden > 0 && <Badge variant="outline">+{hidden}</Badge>}
    </div>
  )
}
