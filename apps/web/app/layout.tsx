import type { Metadata } from 'next'
import { Instrument_Sans, Newsreader } from 'next/font/google'
import './globals.css'

const sans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap'
})

const display = Newsreader({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap'
})

export const metadata: Metadata = {
  title: 'Cooper — sticky pad for AI work',
  description:
    'Capture prompts, answers, and files into a local sticky widget. Copy as a list into ChatGPT, Claude, or Cursor.',
  openGraph: {
    title: 'Cooper',
    description: 'A sticky prompt backlog for AI-assisted work. Local-first. Windows + Mac.',
    type: 'website'
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  )
}
