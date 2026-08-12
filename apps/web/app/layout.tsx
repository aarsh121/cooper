import type { Metadata } from 'next'
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap'
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap'
})

export const metadata: Metadata = {
  title: 'Cooper — sticky pad for AI work',
  description:
    'Capture what matters with a double Shift. Checklist, clipboard, and scratchpad in one local sticky widget for Windows and Mac.',
  openGraph: {
    title: 'Cooper',
    description: 'A sticky widget for AI-assisted work. Local-first. Windows + Mac.',
    type: 'website'
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
