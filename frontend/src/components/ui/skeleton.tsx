import { cn } from '@/lib/utils'

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-gray-700/50 dark:bg-gray-700/50 light:bg-gray-200',
        className
      )}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-800 dark:border-gray-800 light:border-gray-200 bg-gray-900/50 dark:bg-gray-900/50 light:bg-white p-6 space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-gray-800 dark:border-gray-800 light:border-gray-200 bg-gray-900/50 dark:bg-gray-900/50 light:bg-white p-6 space-y-4">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-72 w-full" />
    </div>
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border border-gray-800 dark:border-gray-800 light:border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  )
}
