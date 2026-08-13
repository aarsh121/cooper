const COLORS = ['#ff3b30', '#ffd60a', '#0a84ff', '#30d158', '#f5f5f5'] as const

export function SnipPreview() {
  return (
    <figure className="snip-shot">
      <div className="snip-frame">
        <div className="snip-scene" aria-hidden>
          <div className="snip-desktop">
            <div className="snip-win">
              <div className="snip-win-bar">
                <span className="snip-dots" />
                <span className="snip-win-title">poll.ts</span>
                <span className="snip-win-app">Cursor</span>
              </div>
              <pre className="snip-code">
                <code>
                  <span className="ln">
                    <span className="n">8</span>
                    {'const delay = (ms: number) =>'}
                  </span>
                  <span className="ln">
                    <span className="n">9</span>
                    {'  new Promise((resolve) => setTimeout(resolve, ms))'}
                  </span>
                  <span className="ln dim">
                    <span className="n">10</span>
                  </span>
                  <span className="ln">
                    <span className="n">11</span>
                    {'export async function poll(job: Job) {'}
                  </span>
                  <span className="ln">
                    <span className="n">12</span>
                    {'  const result = await run(job)'}
                  </span>
                  <span className="ln">
                    <span className="n">13</span>
                    {'  if (!result.ok) retry(job)'}
                  </span>
                  <span className="ln">
                    <span className="n">14</span>
                    {'  return result'}
                  </span>
                  <span className="ln">
                    <span className="n">15</span>
                    {'}'}
                  </span>
                  <span className="ln dim">
                    <span className="n">16</span>
                  </span>
                  <span className="ln">
                    <span className="n">17</span>
                    {'// caller never yields while retry is pending'}
                  </span>
                </code>
              </pre>
            </div>
          </div>

          <div className="snip-crop">
            <span className="snip-size">512 × 286</span>
            <svg className="snip-annot" viewBox="0 0 512 286" fill="none">
              <rect x="128" y="94" width="272" height="26" fill="#ffd60a" opacity="0.38" />
              <rect
                x="122"
                y="88"
                width="284"
                height="38"
                rx="2"
                stroke="#0a84ff"
                strokeWidth="3.25"
              />
              <path
                d="M72 34L286 106"
                stroke="#ff3b30"
                strokeWidth="3.25"
                strokeLinecap="round"
              />
              <path d="M286 106l-17.6-9.2L277.4 82.6z" fill="#ff3b30" />
            </svg>
          </div>

          <div className="snip-hint">Mark it up · Enter to save · Esc to retake</div>

          <div className="snip-toolbar">
            <span className="snip-tool on" title="Arrow">
              <svg viewBox="0 0 24 24">
                <path d="M5 19L19 5M19 5h-7M19 5v7" />
              </svg>
            </span>
            <span className="snip-tool" title="Box">
              <svg viewBox="0 0 24 24">
                <rect x="5" y="6" width="14" height="12" rx="1.5" />
              </svg>
            </span>
            <span className="snip-tool" title="Oval">
              <svg viewBox="0 0 24 24">
                <ellipse cx="12" cy="12" rx="8" ry="6" />
              </svg>
            </span>
            <span className="snip-tool" title="Pen">
              <svg viewBox="0 0 24 24">
                <path d="M5 19l4.2-1.1L18 9.1a2 2 0 0 0-2.8-2.8L6.4 15.1 5 19z" />
              </svg>
            </span>
            <span className="snip-tool" title="Highlight">
              <svg viewBox="0 0 24 24">
                <path d="M5 16h14M8 16l2-8h4l2 8" />
              </svg>
            </span>
            <span className="snip-rule" />
            {COLORS.map((value, i) => (
              <span
                key={value}
                className={`snip-swatch${i === 0 ? ' on' : ''}`}
                style={{ background: value }}
              />
            ))}
            <span className="snip-rule" />
            <span className="snip-tool" title="Undo">
              <svg viewBox="0 0 24 24">
                <path d="M8 8H5l4-4M5 8c2.8-3 9-4 12.5 1.5S18 18 12 19" />
              </svg>
            </span>
            <span className="snip-ghost">Retake</span>
            <span className="snip-save">Save</span>
          </div>
        </div>
      </div>
      <figcaption className="snip-caption">
        Drag a region, mark it up, hit Enter — it lands on the pad
      </figcaption>
    </figure>
  )
}
