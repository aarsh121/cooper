export default function HomePage() {
  return (
    <main>
      <div className="page">
        <nav className="nav">
          <a className="logo" href="/">
            <span className="logo-mark" aria-hidden />
            Cooper
          </a>
          <div className="nav-links">
            <a className="hide-sm" href="#how">
              How it works
            </a>
            <a className="hide-sm" href="#privacy">
              Privacy
            </a>
            <a href="#download">Download</a>
          </div>
        </nav>

        <section className="hero">
          <h1 className="brand-hero">Cooper</h1>
          <p className="lede">
            You know how you&apos;re mid-conversation in ChatGPT and think, &ldquo;I&apos;ll need
            this later,&rdquo; but don&apos;t want to stop what you&apos;re doing? Cooper keeps
            the useful parts — prompts, answers, links — in one sticky widget.
          </p>
          <div className="cta-row">
            <a className="btn btn-primary" href="#download">
              Get Cooper — $39
            </a>
            <a className="btn btn-ghost" href="#how">
              See how it works
            </a>
            <span className="price-note">One-time. Windows + Mac.</span>
          </div>

          <div className="stage" aria-label="Product demo">
            <div className="stage-chrome">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <span>Capture anywhere · stay in flow</span>
            </div>
            <div className="stage-body">
              <div className="chat-mock">
                <div className="chat-title">ChatGPT · Claude · Cursor</div>
                <div className="bubble">
                  Here&apos;s a cleaner API shape for the billing webhook…
                </div>
                <div className="bubble selected">
                  Use idempotency keys on every Stripe event. Store `event.id` before side
                  effects. Retry with exponential backoff.
                </div>
                <div className="gesture">Shift · Shift → Captured</div>
              </div>
              <div className="widget-mock">
                <div className="widget">
                  <div className="widget-head">
                    <span className="logo-mark" aria-hidden />
                    <strong>Cooper</strong>
                  </div>
                  <div className="widget-item">
                    <span className="check on" />
                    <span>Draft follow-up prompt for Claude</span>
                  </div>
                  <div className="widget-item">
                    <span className="check" />
                    <span>
                      Use idempotency keys on every Stripe event. Store `event.id` before side
                      effects…
                    </span>
                  </div>
                  <div className="widget-item">
                    <span className="check" />
                    <span>Ask Cursor to wire the webhook tests</span>
                  </div>
                  <div className="capture-flash">Captured</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <h2>To-do. Clipboard. Scratchpad.</h2>
          <p>
            Cooper combines the useful parts of all three into one app built for AI-assisted
            work. Capture with a deliberate gesture, then copy prompts back into whichever
            tool you&apos;re using and check them off as you go.
          </p>
          <div className="grid">
            <article className="cardish">
              <h3>Double Shift capture</h3>
              <p>
                Select text in any app. Tap Left Shift twice. It lands in Cooper without
                stealing focus — a quiet HUD confirms it.
              </p>
            </article>
            <article className="cardish">
              <h3>Sticky always-on-top</h3>
              <p>
                Keep the next prompts beside ChatGPT, Claude, or Cursor. Hide with Right Shift
                twice. Reopen from the tray.
              </p>
            </article>
            <article className="cardish">
              <h3>Copy and continue</h3>
              <p>
                One click copies an item back to your clipboard. Check it off when you&apos;re
                done. Clear the noise when the list grows.
              </p>
            </article>
          </div>
        </section>

        <section className="section" id="privacy">
          <div className="privacy">
            <div>
              <h2>Built to trust with your own work.</h2>
              <p>
                Cooper doesn&apos;t sync anything, doesn&apos;t collect anything, and doesn&apos;t
                need an account. Your notes are saved to a local file. Everything stays on your
                machine.
              </p>
            </div>
            <div className="privacy-box">
              no account
              <br />
              no cloud sync
              <br />
              no analytics
              <br />
              local JSON only
              <br />
              Windows · macOS
            </div>
          </div>
        </section>

        <section className="section buy" id="download">
          <h2>If this feels like something you&apos;d use.</h2>
          <p>
            $39. One-time purchase. After checkout you&apos;ll get Windows and Mac installers.
            macOS needs Accessibility access to read your selection and listen for shortcuts.
          </p>
          <div className="cta-row">
            <a className="btn btn-primary" href="/api/download?platform=win">
              Download for Windows
            </a>
            <a className="btn btn-ghost" href="/api/download?platform=mac">
              Download for Mac
            </a>
          </div>
          <p className="fine">
            30-day refund if it isn&apos;t for you. Not affiliated with shadcn — inspired by Copper.
          </p>
        </section>

        <footer className="footer">
          <span>© {new Date().getFullYear()} Cooper</span>
          <span>Local-first sticky widget for AI work</span>
        </footer>
      </div>
    </main>
  )
}
