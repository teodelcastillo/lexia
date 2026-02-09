import React from "react"
/**
 * Root Layout - Legal Practice Management System
 * 
 * Configures fonts, metadata, and global providers for the application.
 */
import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme/theme-provider'
import './globals.css'

// Professional sans-serif font for the legal application
const _inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const _geistMono = Geist_Mono({ 
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: {
    default: 'LegalHub - Sistema de Gestión Legal',
    template: '%s | LegalHub',
  },
  description: 'Sistema de gestión integral para estudios jurídicos. Administre casos, clientes, tareas, documentos y plazos en un solo lugar.',
  keywords: ['gestión legal', 'abogados', 'casos legales', 'estudio jurídico', 'Argentina'],
  authors: [{ name: 'LegalHub' }],
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1a2744' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1321' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider defaultTheme="system" storageKey="theme-preference">
          {children}
          <Toaster position="top-right" richColors closeButton />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
