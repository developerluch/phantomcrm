import * as React from 'react'
import { Check, ChevronsUpDown, Loader2, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useDebounce } from '@/hooks/useDebounce'

export interface AddressAutocompleteProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

interface NominatimResult {
  place_id: number
  display_name: string
  address: {
    house_number?: string
    road?: string
    city?: string
    town?: string
    village?: string
    hamlet?: string
    state?: string
    postcode?: string
    country_code?: string
  }
}

const STATE_ABBR: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
}

function formatAddress(addr: NominatimResult['address']): string {
  const line1 = [addr.house_number, addr.road].filter(Boolean).join(' ')
  const city = addr.city || addr.town || addr.village || addr.hamlet || ''
  const stateAbbr = STATE_ABBR[addr.state || ''] || addr.state || ''
  const stateZip = [stateAbbr, addr.postcode].filter(Boolean).join(' ')
  return [line1, city, stateZip].filter(Boolean).join(', ')
}

export function AddressAutocomplete({ value, onChange, placeholder = 'Search address...', className, disabled }: AddressAutocompleteProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [results, setResults] = React.useState<NominatimResult[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  // We should debounce the query here
  const debouncedQuery = useDebounce(query, 500)

  React.useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) {
      setResults([])
      return
    }

    let active = true

    async function fetchAddresses() {
      setIsLoading(true)
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(debouncedQuery)}&format=json&addressdetails=1&limit=5&countrycodes=us`)
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        if (active) {
          setResults(data)
        }
      } catch (err) {
        console.error('Address lookup error:', err)
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    fetchAddresses()

    return () => {
      active = false
    }
  }, [debouncedQuery])

  // Handle custom typing when an exact match isn't selected
  const handleCustomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    // If they wipe the input
    if (e.target.value === '') {
      onChange('')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex h-11 w-full justify-between font-normal text-left px-3 items-center rounded-lg border border-border/70 bg-background/55 shadow-inner shadow-black/10 transition-[border-color,box-shadow,background-color] duration-200 hover:border-border focus:bg-background/80 focus:border-primary/60 focus:ring-2 focus:ring-primary/25',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[100] bg-[#0d0d0d]/95 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl overflow-hidden" align="start">
        <Command className="bg-transparent" shouldFilter={false}>
          <CommandInput
            placeholder="Type address..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}
            {!isLoading && query.length > 2 && results.length === 0 && (
              <CommandEmpty>No addresses found.</CommandEmpty>
            )}
            {!isLoading && results.length > 0 && (
              <CommandGroup heading="Suggestions">
                {results.map((place) => (
                  <CommandItem
                    key={place.place_id}
                    value={formatAddress(place.address) || place.display_name}
                    onSelect={() => {
                      onChange(formatAddress(place.address) || place.display_name)
                      setQuery('')
                      setOpen(false)
                    }}
                    className="flex cursor-pointer gap-2 items-start"
                  >
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 opacity-50" />
                    <span className="flex-1 truncate text-xs leading-relaxed">{formatAddress(place.address) || place.display_name}</span>
                    {value === (formatAddress(place.address) || place.display_name) && (
                      <Check className="ml-auto h-4 w-4 opacity-100" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
