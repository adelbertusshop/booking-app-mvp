import type { Metadata, Viewport } from 'next'
import '@/app/globals.css'

export const metadata: Metadata = {
  title: "LUMAR",
  description: "LUMAR — System rezerwacji dla salonów",
}

export const viewport: Viewport = {
  themeColor: '#3b82f6',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <body className="antialiased">{children}</body>
    </html>
  )
}
