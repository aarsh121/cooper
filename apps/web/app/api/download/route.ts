import { NextRequest, NextResponse } from 'next/server'

/**
 * Placeholder download endpoint.
 * Point these env vars at your GitHub Release assets after first publish:
 *   COOPER_WIN_URL, COOPER_MAC_URL
 */
export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get('platform')
  const win = process.env.COOPER_WIN_URL
  const mac = process.env.COOPER_MAC_URL

  if (platform === 'win' && win) {
    return NextResponse.redirect(win)
  }
  if (platform === 'mac' && mac) {
    return NextResponse.redirect(mac)
  }

  const repo = process.env.COOPER_RELEASES_URL || 'https://github.com'
  return NextResponse.redirect(repo)
}
