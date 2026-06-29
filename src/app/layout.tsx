import type { Metadata } from 'next'
import { FeedbackWidget } from '@/components/FeedbackWidget'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Laboratoř',
  description: 'Firemní systém pro správu AI use casů',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <FeedbackWidget />
      </body>
    </html>
  )
}
