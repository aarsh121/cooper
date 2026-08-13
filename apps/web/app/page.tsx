import { InteractiveDemo } from './interactive-demo'

const RELEASES = 'https://github.com/aarsh121/cooper/releases'
const WIN_INSTALLER =
  'https://github.com/aarsh121/cooper/releases/latest/download/TARS-Setup-1.0.1.exe'
const MAC_INSTALLER =
  'https://github.com/aarsh121/cooper/releases/latest/download/TARS-1.0.1-mac.dmg'

export default function HomePage() {
  return (
    <main className="site">
      <header className="nav">
        <a className="logo" href="/">
          <span className="mark" aria-hidden />
          TARS
        </a>
        <a className="nav-cta" href="#download">
          Download
        </a>
      </header>

      <section className="hero">
        <p className="eyebrow">Free · local sticky widget</p>
        <h1>TARS</h1>
        <p className="lede">
          Queue prompts as they appear. Capture with Shift twice. Paste images. Copy a list
          back into ChatGPT, Claude, or Cursor when you&apos;re ready.
        </p>
        <div className="actions">
          <a className="btn primary" href="#download">
            Download free
          </a>
          <a className="btn ghost" href="#demo">
            Play with the demo
          </a>
        </div>
      </section>

      <section className="demo-section" id="demo">
        <InteractiveDemo />
        <p className="demo-hint">
          Watch the loop — or click in and try capture / select yourself
        </p>
      </section>

      <section className="points">
        <article>
          <h2>Capture</h2>
          <p>Select anywhere. Tap Shift twice. TARS keeps it without breaking your flow.</p>
        </article>
        <article>
          <h2>Backlog</h2>
          <p>Prompts, notes, images, files — one sticky pad beside the chat you&apos;re in.</p>
        </article>
        <article>
          <h2>Route</h2>
          <p>Select a few items, copy for chat, paste into your agent. Check them off.</p>
        </article>
        <article>
          <h2>Look</h2>
          <p>Light or dark from the menu. A− / A+ resizes text so the pad stays readable.</p>
        </article>
      </section>

      <section className="trust">
        <h2>No account. No sync. No telemetry.</h2>
        <p>Your notes stay in a local file on your machine. Built to trust with your own work.</p>
      </section>

      <section className="download" id="download">
        <h2>Free for Windows + Mac.</h2>
        <p>Grab the installer from GitHub Releases. Install and go.</p>
        <div className="actions">
          <a className="btn primary" href={WIN_INSTALLER}>
            Download for Windows
          </a>
          <a className="btn ghost" href={MAC_INSTALLER}>
            Download for Mac
          </a>
          <a className="btn ghost" href={RELEASES}>
            All releases on GitHub
          </a>
        </div>

        <div className="mac-note">
          <h3>macOS first launch</h3>
          <p>
            TARS is not notarized yet, so macOS Gatekeeper may block it. After downloading the
            `.dmg`, run:
          </p>
          <pre>
            <code>{`xattr -cr /Applications/TARS.app`}</code>
          </pre>
          <p>Or, if you open it from the mounted disk image first:</p>
          <pre>
            <code>{`xattr -cr /Volumes/TARS*/TARS.app
# then drag TARS into Applications`}</code>
          </pre>
          <p>
            Then open TARS, and grant <strong>Accessibility</strong> when asked (needed for
            Shift-twice capture).
          </p>
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} TARS · Free</span>
        <span>Local-first sticky widget</span>
      </footer>
    </main>
  )
}
