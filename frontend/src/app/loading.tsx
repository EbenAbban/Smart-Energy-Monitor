import { Gauge } from 'lucide-react'

export default function Loading() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <div className="relative">
        <Gauge className="h-12 w-12 text-emerald-500 animate-spin-slow" />
        <div className="absolute inset-0 h-12 w-12 animate-ping rounded-full bg-emerald-500/20" />
      </div>
      <div className="space-y-2 text-center">
        <p className="text-lg font-medium text-white light:text-gray-900 animate-pulse">
          Loading Smart Energy Monitor
        </p>
        <div className="flex items-center justify-center gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '0ms' }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '150ms' }} />
          <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}
