import { NextRequest, NextResponse } from 'next/server'

const REPO = 'aarsh121/cooper'
const RELEASES = `https://github.com/${REPO}/releases/latest`
const FALLBACK_WIN = `https://github.com/${REPO}/releases/download/v1.0.1/TARS-Setup-1.0.1.exe`
const FALLBACK_MAC = `https://github.com/${REPO}/releases/download/v1.0.1/TARS-1.0.1-mac.dmg`

type GithubAsset = {
  name: string
  browser_download_url: string
}

type GithubRelease = {
  assets?: GithubAsset[]
}

async function latestAssets(): Promise<GithubAsset[]> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cooper-web'
    },
    next: { revalidate: 300 }
  })

  if (!res.ok) return []

  const release = (await res.json()) as GithubRelease
  return release.assets ?? []
}

function pickAsset(assets: GithubAsset[], platform: 'win' | 'mac'): string | null {
  if (platform === 'win') {
    return assets.find((asset) => asset.name.toLowerCase().endsWith('.exe'))?.browser_download_url ?? null
  }

  return (
    assets.find((asset) => asset.name.toLowerCase().endsWith('.dmg'))?.browser_download_url ?? null
  )
}

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get('platform')

  if (platform === 'win' && process.env.COOPER_WIN_URL) {
    return NextResponse.redirect(process.env.COOPER_WIN_URL)
  }
  if (platform === 'mac' && process.env.COOPER_MAC_URL) {
    return NextResponse.redirect(process.env.COOPER_MAC_URL)
  }

  if (platform === 'win' || platform === 'mac') {
    const url = pickAsset(await latestAssets(), platform)
    if (url) {
      return NextResponse.redirect(url)
    }
    return NextResponse.redirect(platform === 'win' ? FALLBACK_WIN : FALLBACK_MAC)
  }

  return NextResponse.redirect(process.env.COOPER_RELEASES_URL || RELEASES)
}
