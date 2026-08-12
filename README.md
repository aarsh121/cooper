# TARS

A sticky widget for AI-assisted work — part to-do list, part clipboard, part scratchpad.

Select something worth keeping anywhere on your machine, tap **Shift twice**, and TARS captures it. Jot the next prompts you want to try, copy them into ChatGPT / Claude / Cursor, and check them off as you go.

**Local-first.** No account. No sync. No telemetry. Notes live in a file on your computer.

## What's in this repo

| Path | What it is |
|------|------------|
| `apps/desktop` | Electron sticky widget (Windows `.exe` installer + macOS `.dmg`) |
| `apps/web` | Marketing site (deploy to Vercel) |

## Features

- Always-on-top floating sticky panel
- Double **Left Shift** → capture current text selection
- Double **Right Shift** → show / hide panel
- Fallback shortcuts: `Ctrl/⌘⇧C` capture, `Ctrl/⌘⇧Space` toggle
- Paste images from clipboard
- Multi-select → copy for chat (text + real images)
- Local JSON storage only

## Quick start

```bash
npm install
npm run dev:desktop   # sticky widget
npm run dev:web       # landing page at http://localhost:3000
```

### Build installers

```bash
# Windows NSIS installer → apps/desktop/release/TARS-Setup-1.0.0.exe
npm run pack:win

# macOS DMG (run on macOS or via GitHub Actions on tag push)
npm run pack:mac
```

## Download (free)

Installers are published on [GitHub Releases](https://github.com/aarsh121/cooper/releases).

### macOS Gatekeeper

TARS is not notarized yet. After installing, clear quarantine flags:

```bash
xattr -cr /Applications/TARS.app
```

Then grant **Accessibility** access when prompted.

## Deploy the site to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set **Root Directory** to `apps/web`.
4. Framework: Next.js (auto-detected).
5. Deploy.

## Privacy

TARS never phones home. Your notes stay in:

- Windows: `%APPDATA%/tars-data.json` (via electron-store)
- macOS: `~/Library/Application Support/tars-data.json`

## License

MIT-style / your project.
