import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { ToastProvider } from '@/components/ui/toast'
import { SocketAlertListener } from '@/components/socket-alert-listener'
import GridScan from '@/components/react-bits/GridScan'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Smart Energy Monitor',
  description: 'Real-time energy monitoring and management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-950 text-gray-200 antialiased light:bg-gray-50 light:text-gray-900 transition-colors duration-300`}>
        <ThemeProvider>
          <ToastProvider>
            <div className="fixed inset-0 z-0 pointer-events-none">
              <GridScan
                enableWebcam={false}
                linesColor="#1f2937"
                scanColor="#10b981"
                gridScale={0.12}
                scanOpacity={0.35}
                lineThickness={1}
                lineJitter={0.08}
                enablePost
                bloomIntensity={0.5}
                chromaticAberration={0.0015}
                noiseIntensity={0.01}
                scanDuration={2.5}
                scanDelay={2.5}
              />
            </div>
            <SocketAlertListener />
            <ThemeToggle />
            <Sidebar />
            <main className="relative z-10 min-h-screen p-4 pt-16 md:ml-64 md:p-8">
              {children}
            </main>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
