import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { CooperItem, CooperSettings, CooperState } from '../../../shared/types'

const emptyState: CooperState = {
  items: [],
  settings: {
    alwaysOnTop: true,
    launchAtLogin: true,
    showInTray: true,
    opacity: 0.96
  }
}

export default function App() {
  const [state, setState] = useState<CooperState>(emptyState)
  const [draft, setDraft] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    void window.cooper.getState().then(setState)
    return window.cooper.onState(setState)
  }, [])

  const openCount = useMemo(
    () => state.items.filter((item) => !item.done).length,
    [state.items]
  )

  async function refresh(): Promise<void> {
    setState(await window.cooper.getState())
  }

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    const kind = text.startsWith('[ ]') || text.startsWith('- [ ]') ? 'task' : 'note'
    await window.cooper.addItem(text.replace(/^(- )?\[ \]\s*/, ''), kind)
    setDraft('')
    await refresh()
  }

  async function toggleDone(item: CooperItem): Promise<void> {
    await window.cooper.updateItem(item.id, { done: !item.done })
    await refresh()
  }

  async function copyItem(item: CooperItem): Promise<void> {
    await window.cooper.copyText(item.text)
    setCopiedId(item.id)
    window.setTimeout(() => setCopiedId((id) => (id === item.id ? null : id)), 900)
  }

  async function removeItem(id: string): Promise<void> {
    await window.cooper.removeItem(id)
    await refresh()
  }

  async function clearDone(): Promise<void> {
    await window.cooper.clearDone()
    await refresh()
  }

  async function patchSettings(partial: Partial<CooperSettings>): Promise<void> {
    const settings = await window.cooper.setSettings(partial)
    setState((prev) => ({ ...prev, settings }))
  }

  const isMac = navigator.platform.toUpperCase().includes('MAC')
  const mod = isMac ? '⌘' : 'Ctrl'

  return (
    <div className="app">
      <div className="shell">
        <header className="titlebar">
          <div className="brand">
            <div className="mark" aria-hidden />
            <div className="brand-copy">
              <strong>Cooper</strong>
              <span>Sticky pad for AI work</span>
            </div>
          </div>
          <div className="actions">
            <button
              className="icon-btn"
              title="Settings"
              onClick={() => setShowSettings((v) => !v)}
              aria-label="Settings"
            >
              ⚙
            </button>
            <button
              className="icon-btn"
              title="Hide"
              onClick={() => void window.cooper.hideWindow()}
              aria-label="Hide"
            >
              −
            </button>
          </div>
        </header>

        <div className="composer">
          <form onSubmit={(e) => void onSubmit(e)}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a prompt, note, or task…"
              autoFocus
            />
            <button className="primary" type="submit">
              Add
            </button>
          </form>
        </div>

        <div className="hints">
          <span className="chip">
            Capture <kbd>Shift</kbd>
            <kbd>Shift</kbd>
          </span>
          <span className="chip">
            Toggle <kbd>Right Shift</kbd>
            <kbd>Shift</kbd>
          </span>
          <span className="chip">
            Fallback <kbd>{mod}</kbd>
            <kbd>⇧</kbd>
            <kbd>C</kbd>
          </span>
        </div>

        {showSettings ? (
          <div className="settings">
            <div className="setting-row">
              <label>
                <input
                  type="checkbox"
                  checked={state.settings.alwaysOnTop}
                  onChange={(e) => void patchSettings({ alwaysOnTop: e.target.checked })}
                />
                Always on top
              </label>
            </div>
            <div className="setting-row">
              <label>
                <input
                  type="checkbox"
                  checked={state.settings.launchAtLogin}
                  onChange={(e) => void patchSettings({ launchAtLogin: e.target.checked })}
                />
                Launch at login
              </label>
            </div>
            <div className="setting-row">
              <span>Opacity</span>
              <input
                type="range"
                min={0.7}
                max={1}
                step={0.01}
                value={state.settings.opacity}
                onChange={(e) => void patchSettings({ opacity: Number(e.target.value) })}
              />
            </div>
            <div className="setting-row">
              <button className="linkish" onClick={() => void window.cooper.openDataFile()}>
                Reveal local data file
              </button>
            </div>
          </div>
        ) : null}

        <div className="list">
          {state.items.length === 0 ? (
            <div className="empty">
              <strong>Nothing here yet</strong>
              Select text anywhere, tap Shift twice, and Cooper keeps it.
            </div>
          ) : (
            state.items.map((item) => (
              <article key={item.id} className={`item${item.done ? ' done' : ''}`}>
                <button
                  className="check"
                  onClick={() => void toggleDone(item)}
                  aria-label={item.done ? 'Mark incomplete' : 'Mark done'}
                >
                  ✓
                </button>
                <div>
                  <div className="body">{item.text}</div>
                  <div className="meta">
                    <span className="tag">{item.kind}</span>
                  </div>
                </div>
                <div className="item-actions">
                  <button className="icon-btn" title="Copy" onClick={() => void copyItem(item)}>
                    {copiedId === item.id ? '✓' : '⧉'}
                  </button>
                  <button className="icon-btn" title="Delete" onClick={() => void removeItem(item.id)}>
                    ×
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

        <footer className="footer">
          <span>
            {openCount} open · local only · no account
          </span>
          <button className="linkish" onClick={() => void clearDone()}>
            Clear done
          </button>
        </footer>
      </div>
    </div>
  )
}
