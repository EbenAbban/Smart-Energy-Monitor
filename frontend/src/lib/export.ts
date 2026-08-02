export function downloadCSV(
  data: Record<string, unknown>[],
  filename: string
) {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((h) => {
        const val = row[h]
        const str = val == null ? '' : String(val)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"`
          : str
      }).join(',')
    ),
  ]

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function formatDateRange(from: Date, to: Date): string {
  return `${from.toISOString().split('T')[0]}--${to.toISOString().split('T')[0]}`
}

export function estimateCost(
  kwh: number,
  rate: number = 0.12,
  peakRate: number = 0.18,
  isPeak: boolean = false
): number {
  return kwh * (isPeak ? peakRate : rate)
}
