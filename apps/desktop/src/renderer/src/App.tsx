import { ClipboardEvent, FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { CooperAttachment, CooperItem, CooperState } from '../../../shared/types'

const emptyState: CooperState = {
  items: [],
  settings: {
    alwaysOnTop: true,
    launchAtLogin: true,
    showInTray: true,
    opacity: 1
  }
}

function renderRichText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return <span key={index}>{part}</span>
  })
}

function itemCopyText(item: CooperItem): string {
  const text = item.text?.trim()
  if (text && text !== 'Image') return text
  if (item.attachments.some(isImageAttachment)) return ''
  const files = item.attachments.map((f) => f.name).join(', ')
  return files
}

function groupBySection(items: CooperItem[]): { section: string; items: CooperItem[] }[] {
  const map = new Map<string, CooperItem[]>()
  for (const item of items) {
    const key = item.section?.trim() || 'Inbox'
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return Array.from(map.entries()).map(([section, grouped]) => ({ section, items: grouped }))
}

function isImageAttachment(file: CooperAttachment): boolean {
  return file.mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name)
}

function AttachmentPreview({
  file,
  onRemove,
  onOpen
}: {
  file: CooperAttachment
  onRemove?: () => void
  onOpen?: () => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!isImageAttachment(file)) return
    let alive = true
    setFailed(false)
    setSrc(null)
    void window.tars.readAttachmentDataUrl(file.path).then((url) => {
      if (!alive) return
      if (url) setSrc(url)
      else setFailed(true)
    })
    return () => {
      alive = false
    }
  }, [file.path, file.mime, file.name])

  if (isImageAttachment(file) && !failed) {
    return (
      <button
        type="button"
        className="image-chip"
        title={file.name}
        onClick={(e) => {
          e.stopPropagation()
          onOpen?.()
        }}
      >
        {src ? (
          <img
            src={src}
            alt={file.name}
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="image-chip-loading" />
        )}
        {onRemove ? (
          <span
            className="image-chip-x"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            ×
          </span>
        ) : null}
      </button>
    )
  }

  return (
    <button
      type="button"
      className="file-chip"
      title={file.path}
      onClick={(e) => {
        e.stopPropagation()
        if (onRemove) onRemove()
        else onOpen?.()
      }}
    >
      📎 <span>{file.name}</span>
      {onRemove ? ' ×' : ''}
    </button>
  )
}

export default function App() {
  const [state, setState] = useState<CooperState>(emptyState)
  const [draft, setDraft] = useState('')
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pendingFiles, setPendingFiles] = useState<CooperAttachment[]>([])
  const [dragging, setDragging] = useState(false)
  const [copiedFlash, setCopiedFlash] = useState(false)
  const [pasteHint, setPasteHint] = useState(false)
  const dragDepth = useRef(0)
  const resizing = useRef(false)
  const lastResize = useRef({ x: 0, y: 0 })

  useEffect(() => {
    void window.tars.getState().then(setState)
    return window.tars.onState(setState)
  }, [])

  useEffect(() => {
    function onMove(event: globalThis.MouseEvent): void {
      if (!resizing.current) return
      const dx = event.screenX - lastResize.current.x
      const dy = event.screenY - lastResize.current.y
      lastResize.current = { x: event.screenX, y: event.screenY }
      void window.tars.resizeBy({ dx, dy })
    }
    function onUp(): void {
      resizing.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const openFirst = [...state.items].sort((a, b) => Number(a.done) - Number(b.done))
    if (!q) return openFirst
    return openFirst.filter(
      (item) =>
        item.text.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q) ||
        item.attachments.some((f) => f.name.toLowerCase().includes(q))
    )
  }, [state.items, query])

  const groups = useMemo(() => groupBySection(filtered), [filtered])

  async function refresh(): Promise<void> {
    setState(await window.tars.getState())
  }

  async function queueAttachments(files: CooperAttachment[]): Promise<void> {
    if (!files.length) return
    setPendingFiles((prev) => [...prev, ...files])
    setPasteHint(true)
    window.setTimeout(() => setPasteHint(false), 1200)
  }

  async function pasteFromEvent(event: ClipboardEvent): Promise<boolean> {
    const items = event.clipboardData?.items
    if (!items?.length) return false

    const saved: CooperAttachment[] = []

    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (!file) continue
        const buffer = await file.arrayBuffer()
        const attachment = await window.tars.saveBuffer({
          bytes: buffer,
          fileName: file.name || `paste-${Date.now()}.png`,
          mime: file.type || undefined
        })
        saved.push(attachment)
      }
    }

    if (saved.length) {
      event.preventDefault()
      await queueAttachments(saved)
      return true
    }
    return false
  }

  async function pasteFromNativeClipboard(): Promise<void> {
    const files = await window.tars.pasteClipboard()
    await queueAttachments(files)
  }

  async function onPaste(event: ClipboardEvent): Promise<void> {
    const handled = await pasteFromEvent(event)
    if (handled) return

    // Screenshots / OS clipboard images often don't appear in clipboardData on Windows.
    const nativeFiles = await window.tars.pasteClipboard()
    if (nativeFiles.length) {
      event.preventDefault()
      await queueAttachments(nativeFiles)
    }
  }

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const text = draft.trim()
    if (!text && pendingFiles.length === 0) return
    await window.tars.addItem(text || 'Image', pendingFiles.length ? 'file' : 'note', {
      attachments: pendingFiles
    })
    setDraft('')
    setPendingFiles([])
    await refresh()
  }

  function toggleSelected(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function toggleDone(item: CooperItem, event: MouseEvent): Promise<void> {
    event.stopPropagation()
    await window.tars.updateItem(item.id, { done: !item.done })
    await refresh()
  }

  async function copySelectedAsList(): Promise<void> {
    const selectedItems = state.items.filter((item) => selected.has(item.id))
    if (selectedItems.length === 0) return
    const texts = selectedItems.map(itemCopyText).filter(Boolean)
    const imagePaths = selectedItems.flatMap((item) =>
      item.attachments.filter(isImageAttachment).map((f) => f.path)
    )
    const result = await window.tars.copySelection({ texts, imagePaths })
    setCopiedFlash(true)
    window.setTimeout(() => setCopiedFlash(false), 1200)
    if (result.copiedImages > 0 && !result.copiedText) {
      // image-only copy still shows Copied
    }
  }

  async function deleteSelected(): Promise<void> {
    await window.tars.removeItems([...selected])
    setSelected(new Set())
    await refresh()
  }

  async function attachFiles(): Promise<void> {
    const files = await window.tars.pickFiles()
    if (files.length) setPendingFiles((prev) => [...prev, ...files])
  }

  async function onDropFiles(paths: string[]): Promise<void> {
    if (!paths.length) return
    const files = await window.tars.importPaths(paths)
    setPendingFiles((prev) => [...prev, ...files])
  }

  return (
    <div
      className="app"
      onPaste={(e) => void onPaste(e)}
      onDragEnter={(e) => {
        e.preventDefault()
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        dragDepth.current -= 1
        if (dragDepth.current <= 0) {
          dragDepth.current = 0
          setDragging(false)
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        const paths = Array.from(e.dataTransfer.files)
          .map((f) => (f as File & { path?: string }).path)
          .filter((p): p is string => Boolean(p))
        void onDropFiles(paths)
      }}
    >
      <div className="shell">
        <div className="topbar">
          <label className="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
            />
          </label>
          <div className="top-actions">
            <button
              className="menu-btn"
              aria-label="Minimize TARS"
              title="Minimize (keeps running in tray)"
              onClick={() => void window.tars.hideWindow()}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                <path d="M6 12h12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              className="menu-btn"
              aria-label="Settings"
              title="Settings"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                <circle cx="12" cy="6" r="1.6" fill="currentColor" />
                <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                <circle cx="12" cy="18" r="1.6" fill="currentColor" />
              </svg>
            </button>
            <button
              className="menu-btn menu-btn-close"
              aria-label="Quit TARS"
              title="Quit TARS"
              onClick={() => void window.tars.quitApp()}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
                <path
                  d="M7 7l10 10M17 7L7 17"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="menu-pop">
            <button
              onClick={() => {
                setMenuOpen(false)
                void window.tars.setSettings({ alwaysOnTop: !state.settings.alwaysOnTop }).then(
                  (settings) => setState((prev) => ({ ...prev, settings }))
                )
              }}
            >
              {state.settings.alwaysOnTop ? 'Unpin window' : 'Always on top'}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                void window.tars.openDataFile()
              }}
            >
              Reveal data file
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                void window.tars.clearDone().then(refresh)
              }}
            >
              Clear done
            </button>
            <button
              onClick={() => {
                setMenuOpen(false)
                void window.tars.hideWindow()
              }}
            >
              Minimize to tray
            </button>
            <button
              className="danger"
              onClick={() => {
                setMenuOpen(false)
                void window.tars.quitApp()
              }}
            >
              Quit TARS
            </button>
          </div>
        ) : null}

        <div className="list" onClick={() => setMenuOpen(false)}>
          {groups.length === 0 ? (
            <div className="empty">
              Select text anywhere and tap Shift twice.
              <br />
              Or paste an image / add a prompt below.
            </div>
          ) : (
            groups.map((group) => (
              <section className="section" key={group.section}>
                <div className="section-head">
                  <span>{group.section}</span>
                </div>
                <div className="cards">
                  {group.items.map((item) => (
                    <article
                      key={item.id}
                      className={`card${selected.has(item.id) ? ' selected' : ''}${item.done ? ' done' : ''}`}
                      onClick={() => toggleSelected(item.id)}
                    >
                      <button
                        className={`circle${item.done ? ' on' : ''}`}
                        aria-label={item.done ? 'Mark incomplete' : 'Mark done'}
                        onClick={(e) => void toggleDone(item, e)}
                      />
                      <div>
                        {item.text ? <div className="body">{renderRichText(item.text)}</div> : null}
                        {item.attachments.length > 0 ? (
                          <div className="files">
                            {item.attachments.map((file) => (
                              <AttachmentPreview
                                key={file.id}
                                file={file}
                                onOpen={() => void window.tars.revealAttachment(file.path)}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        {selected.size > 0 ? (
          <div className="selection-bar">
            <span>{selected.size} selected</span>
            <button className="primary" onClick={() => void copySelectedAsList()}>
              {copiedFlash ? 'Copied' : 'Copy for chat'}
            </button>
            <button onClick={() => void deleteSelected()}>Delete</button>
            <button onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        ) : null}

        <div className="composer-wrap">
          {pendingFiles.length > 0 ? (
            <div className="pending-files">
              {pendingFiles.map((file) => (
                <AttachmentPreview
                  key={file.id}
                  file={file}
                  onRemove={() => setPendingFiles((prev) => prev.filter((f) => f.id !== file.id))}
                />
              ))}
            </div>
          ) : null}
          <form className="composer" onSubmit={(e) => void onSubmit(e)}>
            <span className="circle" aria-hidden />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={pasteHint ? 'Image pasted — add note & send' : 'Add a note or a prompt'}
            />
            <div className="composer-actions">
              <button
                type="button"
                className="icon-quiet"
                title="Paste image from clipboard"
                onClick={() => void pasteFromNativeClipboard()}
              >
                ⎘
              </button>
              <button
                type="button"
                className="icon-quiet"
                title="Attach files"
                onClick={() => void attachFiles()}
              >
                📎
              </button>
              <button type="submit" className="icon-quiet" title="Add">
                ↑
              </button>
            </div>
          </form>
        </div>

        {dragging ? <div className="drop-overlay">Drop files to attach</div> : null}
        <div
          className="resize-grip"
          title="Drag to resize"
          aria-label="Resize window"
          onMouseDown={(event) => {
            event.preventDefault()
            resizing.current = true
            lastResize.current = { x: event.screenX, y: event.screenY }
          }}
        />
      </div>
    </div>
  )
}
