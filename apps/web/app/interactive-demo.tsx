'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type DemoItem = {
  id: string
  section: string
  text: string
  done: boolean
  selected: boolean
}

const STARTER: DemoItem[] = [
  {
    id: '1',
    section: 'Research',
    text: '**Negation in inherited configs.** The moment a config can extend a base, someone needs to remove an extension…',
    done: false,
    selected: false
  },
  {
    id: '2',
    section: 'Configuration Formats',
    text: 'Use **TOML as the default declarative format**, backed by a published schema',
    done: false,
    selected: false
  }
]

function rich(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export function InteractiveDemo() {
  const [items, setItems] = useState(STARTER)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [flash, setFlash] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setStep((s) => (s + 1) % 4), 2800)
    return () => window.clearInterval(id)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter(
      (item) =>
        !q ||
        item.text.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q)
    )
  }, [items, query])

  const groups = useMemo(() => {
    const map = new Map<string, DemoItem[]>()
    for (const item of filtered) {
      const list = map.get(item.section) ?? []
      list.push(item)
      map.set(item.section, list)
    }
    return Array.from(map.entries())
  }, [filtered])

  const selectedCount = items.filter((i) => i.selected).length

  function showFlash(message: string) {
    setFlash(message)
    window.setTimeout(() => setFlash(null), 1100)
  }

  function captureDemo() {
    const next: DemoItem = {
      id: String(Date.now()),
      section: 'Inbox',
      text: '**Paste into Claude.** Ask for a sharper docs outline before the review.',
      done: false,
      selected: false
    }
    setItems((prev) => [next, ...prev])
    showFlash('Captured')
  }

  function addDraft(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setItems((prev) => [
      {
        id: String(Date.now()),
        section: 'Inbox',
        text,
        done: false,
        selected: false
      },
      ...prev
    ])
    setDraft('')
  }

  function copySelected() {
    const lines = items
      .filter((i) => i.selected)
      .map((i) => `- ${i.text.replace(/\*\*/g, '')}`)
    if (!lines.length) return
    void navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    showFlash('Copied as list')
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div className="demo">
      <div className="demo-stage">
        <div className={`demo-chat${step === 1 ? ' highlight' : ''}`}>
          <div className="demo-label">ChatGPT · Claude · Cursor</div>
          <p className="demo-bubble">Here&apos;s a cleaner shape for the docs review…</p>
          <p className={`demo-bubble selectable${step === 1 ? ' on' : ''}`}>
            Paste into Claude. Ask for a sharper docs outline before the review.
          </p>
          <button type="button" className="demo-gesture" onClick={captureDemo}>
            {step === 1 ? 'Shift · Shift — click to capture' : 'Try capture'}
          </button>
        </div>

        <div className="demo-widget" aria-label="TARS interactive demo">
          <div className="dw-top">
            <label className="dw-search">
              <span aria-hidden>⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
              />
            </label>
            <button type="button" className="dw-menu" aria-label="Menu">
              ···
            </button>
          </div>

          <div className="dw-list">
            {groups.map(([section, sectionItems]) => (
              <section key={section} className="dw-section">
                <div className="dw-section-head">
                  <span>{section}</span>
                </div>
                <div className="dw-cards">
                  {sectionItems.map((item) => (
                    <article
                      key={item.id}
                      className={`dw-card${item.selected ? ' selected' : ''}${item.done ? ' done' : ''}`}
                      onClick={() =>
                        setItems((prev) =>
                          prev.map((x) =>
                            x.id === item.id ? { ...x, selected: !x.selected } : x
                          )
                        )
                      }
                    >
                      <button
                        type="button"
                        className={`dw-circle${item.done ? ' on' : ''}`}
                        aria-label="Toggle done"
                        onClick={(e) => {
                          e.stopPropagation()
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === item.id ? { ...x, done: !x.done } : x
                            )
                          )
                        }}
                      />
                      <div className="dw-body">{rich(item.text)}</div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {selectedCount > 0 ? (
            <div className="dw-selectbar">
              <span>{selectedCount} selected</span>
              <button type="button" onClick={copySelected}>
                {copied ? 'Copied' : 'Copy as list'}
              </button>
            </div>
          ) : null}

          <form className="dw-composer" onSubmit={addDraft}>
            <span className="dw-circle" aria-hidden />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a note or a prompt"
            />
            <button type="submit" aria-label="Add">
              ↑
            </button>
          </form>

          {flash ? <div className="dw-flash">{flash}</div> : null}
        </div>
      </div>
    </div>
  )
}
