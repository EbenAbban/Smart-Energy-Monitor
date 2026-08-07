import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { ThemeProvider } from '@/components/theme-provider'
import { ThemeToggle } from '@/components/theme-toggle'
import { ToastProvider } from '@/components/ui/toast'
import { SocketAlertListener } from '@/components/socket-alert-listener'
import AppBackground from '@/components/app-background'

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
              <AppBackground />
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
