import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded bg-muted', className)} />
}

interface TableSkeletonProps {
  rows?: number
  cols?: number
}

export function TableSkeleton({ rows = 5, cols = 4 }: TableSkeletonProps) {
  return (
    <div className="w-full space-y-3">
      {/* Header row */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={`header-${c}`} className="h-4 w-3/4" />
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-border" />

      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={`row-${r}`}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton
              key={`cell-${r}-${c}`}
              className={cn('h-3', c === 0 ? 'w-full' : 'w-2/3')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

interface CardGridSkeletonProps {
  count?: number
}

export function CardGridSkeleton({ count = 4 }: CardGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`card-${i}`}
          className="rounded-xl border border-border bg-card p-5 space-y-3"
        >
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  )
}
