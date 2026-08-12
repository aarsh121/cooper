# Cooper

A sticky widget for AI-assisted work — part to-do list, part clipboard, part scratchpad.

Select something worth keeping anywhere on your machine, tap **Shift twice**, and Cooper captures it. Jot the next prompts you want to try, copy them into ChatGPT / Claude / Cursor, and check them off as you go.

**Local-first.** No account. No sync. No telemetry. Notes live in a file on your computer.

Inspired by [Copper](https://shadcn.com/copper) by shadcn.

## What's in this repo

| Path | What it is |
|------|------------|
| `apps/desktop` | Electron sticky widget (Windows `.exe` installer + macOS `.dmg`) |
| `apps/web` | Premium marketing site (deploy to Vercel) |

## Features

- Always-on-top floating sticky panel
- Double **Left Shift** → capture current text selection
- Double **Right Shift** → show / hide panel
- Fallback shortcuts: `Ctrl/⌘⇧C` capture, `Ctrl/⌘⇧Space` toggle
- Checklist + scratchpad items with one-click copy
- System tray presence
- Local JSON storage only

## Quick start

```bash
npm install
npm run dev:desktop   # sticky widget
npm run dev:web       # landing page at http://localhost:3000
```

### Build installers

```bash
# Windows NSIS installer → apps/desktop/release/Cooper-Setup-1.0.0.exe
npm run pack:win

# macOS DMG (run on macOS or via GitHub Actions on tag push)
npm run pack:mac
```

First Windows pack may need Developer Mode if electron-builder hits symlink errors; this repo sets `signAndEditExecutable: false` for local unsigned builds. Signed releases should run through GitHub Actions.

## Permissions

- **macOS 14+**: grant Accessibility so Cooper can read the current selection and listen for Shift gestures.
- **Windows**: first launch may prompt for accessibility / input monitoring depending on OS policy.

## Deploy the site to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Set **Root Directory** to `apps/web`.
4. Framework: Next.js (auto-detected).
5. Deploy.

Or from the CLI:

```bash
cd apps/web
npx vercel
```

## Privacy

Cooper never phones home. Your notes stay in:

- Windows: `%APPDATA%/cooper-data.json` (via electron-store)
- macOS: `~/Library/Application Support/cooper-data.json`

## License

Private / your project. Not affiliated with shadcn or Vercel.
