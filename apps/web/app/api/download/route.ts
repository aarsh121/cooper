import { NextRequest, NextResponse } from 'next/server'

const RELEASES = 'https://github.com/aarsh121/cooper/releases/latest'
const WIN =
  process.env.COOPER_WIN_URL ||
  'https://github.com/aarsh121/cooper/releases/latest/download/Cooper-Setup-1.0.0.exe'
const MAC =
  process.env.COOPER_MAC_URL ||
  'https://github.com/aarsh121/cooper/releases/latest/download/Cooper-1.0.0-mac.dmg'

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get('platform')

  if (platform === 'win') {
    return NextResponse.redirect(WIN)
  }
  if (platform === 'mac') {
    return NextResponse.redirect(MAC)
  }

  return NextResponse.redirect(process.env.COOPER_RELEASES_URL || RELEASES)
}
