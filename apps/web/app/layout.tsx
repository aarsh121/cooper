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
    title: 'TARS — sticky pad for AI work',
  description:
    'Capture prompts, snip the screen and mark it up, then copy a list into ChatGPT, Claude, or Cursor. Local sticky widget.',
  openGraph: {
    title: 'TARS',
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
