import { InteractiveDemo } from './interactive-demo'

export default function HomePage() {
  return (
    <main className="site">
      <header className="nav">
        <a className="logo" href="/">
          <span className="mark" aria-hidden />
          Cooper
        </a>
        <a className="nav-cta" href="#download">
          Download
        </a>
      </header>

      <section className="hero">
        <p className="eyebrow">Local sticky widget</p>
        <h1>Cooper</h1>
        <p className="lede">
          Queue prompts as they appear. Capture with Shift twice. Paste images. Copy a list
          back into ChatGPT, Claude, or Cursor when you&apos;re ready.
        </p>
        <div className="actions">
          <a className="btn primary" href="#download">
            Get Cooper — $39
          </a>
          <a className="btn ghost" href="#demo">
            Play with the demo
          </a>
        </div>
      </section>

      <section className="demo-section" id="demo">
        <InteractiveDemo />
        <p className="demo-hint">
          Click a card to select · circle to check off · capture button · copy as list
        </p>
      </section>

      <section className="points">
        <article>
          <h2>Capture</h2>
          <p>Select anywhere. Tap Shift twice. Cooper keeps it without breaking your flow.</p>
        </article>
        <article>
          <h2>Backlog</h2>
          <p>Prompts, notes, images, files — one sticky pad beside the chat you&apos;re in.</p>
        </article>
        <article>
          <h2>Route</h2>
          <p>Select a few items, copy as a list, paste into your agent. Check them off.</p>
        </article>
      </section>

      <section className="trust">
        <h2>No account. No sync. No telemetry.</h2>
        <p>Your notes stay in a local file on your machine. Built to trust with your own work.</p>
      </section>

      <section className="download" id="download">
        <h2>One-time purchase. Windows + Mac.</h2>
        <p>$39. After checkout you get installers. 30-day refund if it isn&apos;t for you.</p>
        <div className="actions">
          <a className="btn primary" href="/api/download?platform=win">
            Download for Windows
          </a>
          <a className="btn ghost" href="/api/download?platform=mac">
            Download for Mac
          </a>
        </div>
      </section>

      <footer className="footer">
        <span>© {new Date().getFullYear()} Cooper</span>
        <span>Inspired by Copper · not affiliated</span>
      </footer>
    </main>
  )
}
