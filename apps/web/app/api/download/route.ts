import { NextRequest, NextResponse } from 'next/server'

const REPO = 'aarsh121/cooper'
const RELEASES = `https://github.com/${REPO}/releases/latest`
const FALLBACK_WIN = `https://github.com/${REPO}/releases/download/v1.0.4/TARS-Setup-1.0.4.exe`
const FALLBACK_MAC = `https://github.com/${REPO}/releases/download/v1.0.4/TARS-1.0.4-mac-arm64.dmg`
const FALLBACK_MAC_INTEL = `https://github.com/${REPO}/releases/download/v1.0.4/TARS-1.0.4-mac-x64.dmg`

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

function pickAsset(
  assets: GithubAsset[],
  platform: 'win' | 'mac',
  arch: 'arm64' | 'x64'
): string | null {
  if (platform === 'win') {
    return assets.find((asset) => asset.name.toLowerCase().endsWith('.exe'))?.browser_download_url ?? null
  }

  const dmgs = assets.filter((asset) => asset.name.toLowerCase().endsWith('.dmg'))
  const forArch = dmgs.find((asset) => asset.name.toLowerCase().includes(arch))
  return (forArch ?? dmgs[0])?.browser_download_url ?? null
}

function redirect(url: string): NextResponse {
  const response = NextResponse.redirect(url)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get('platform')
  const arch = request.nextUrl.searchParams.get('arch') === 'x64' ? 'x64' : 'arm64'

  if (platform === 'win' || platform === 'mac') {
    const macFallback = arch === 'x64' ? FALLBACK_MAC_INTEL : FALLBACK_MAC
    const url =
      pickAsset(await latestAssets(), platform, arch) ||
      (platform === 'win' ? process.env.COOPER_WIN_URL : process.env.COOPER_MAC_URL) ||
      (platform === 'win' ? FALLBACK_WIN : macFallback)
    return redirect(url)
  }

  return redirect(process.env.COOPER_RELEASES_URL || RELEASES)
}
