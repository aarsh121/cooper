import {
  ClipboardEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  parseSectionPrefix,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  type CooperAttachment,
  type CooperItem,
  type CooperState
} from '../../shared/types'

const emptyState: CooperState = {
  items: [],
  settings: {
    alwaysOnTop: true,
    launchAtLogin: true,
    showInTray: true,
    opacity: 1,
    activeSection: '',
    theme: 'light',
    fontSize: 14
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function itemCopyText(item: CooperItem): string {
  const text = item.text?.trim()
  if (text && text !== 'Image') return text
  if (item.attachments.some(isImageAttachment)) return ''
  const files = item.attachments.map((f) => f.name).join(', ')
  return files
}

function groupBySection(
  items: CooperItem[],
  activeSection?: string
): { section: string; items: CooperItem[] }[] {
  const map = new Map<string, CooperItem[]>()
  const active = activeSection?.trim()
  if (active && active.toLowerCase() !== 'inbox') {
    map.set(active, [])
  }
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

const MAX_INLINE_DRAG_BYTES = 24 * 1024 * 1024

// dragstart is synchronous, so attachment bytes have to already be in memory by the
// time a drag begins. Previews populate this for images; cards prefetch on pointerdown.
const attachmentData = new Map<string, string>()
const attachmentReads = new Map<string, Promise<string | null>>()

function readAttachment(filePath: string): Promise<string | null> {
  const cached = attachmentData.get(filePath)
  if (cached) return Promise.resolve(cached)
  const inFlight = attachmentReads.get(filePath)
  if (inFlight) return inFlight
  const read = window.tars.readAttachmentDataUrl(filePath).then((url) => {
    if (url) attachmentData.set(filePath, url)
    attachmentReads.delete(filePath)
    return url
  })
  attachmentReads.set(filePath, read)
  return read
}

function attachmentBuffer(filePath: string): ArrayBuffer | null {
  const dataUrl = attachmentData.get(filePath)
  if (!dataUrl) return null
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return null
  try {
    const binary = atob(dataUrl.slice(comma + 1))
    const buffer = new ArrayBuffer(binary.length)
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return buffer
  } catch {
    return null
  }
}

function pathToFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\/+/, '')
  return `file:///${encodeURI(normalized).replace(/#/g, '%23').replace(/\?/g, '%3F')}`
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
    setSrc(attachmentData.get(file.path) ?? null)
    void readAttachment(file.path).then((url) => {
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
        draggable={false}
        onClick={(e) => {
          e.stopPropagation()
          onOpen?.()
        }}
      >
        {src ? (
          <img
            src={src}
            alt={file.name}
            draggable={false}
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
      draggable={false}
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
  const draggingOut = useRef(false)
  const dragOutTimer = useRef(0)
  const resizing = useRef(false)
  const lastResize = useRef({ x: 0, y: 0 })
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.tars.getState().then(setState)
    return window.tars.onState(setState)
  }, [])

  useEffect(() => {
    return window.tars.onDragEnded(() => {
      if (dragOutTimer.current) {
        window.clearTimeout(dragOutTimer.current)
        dragOutTimer.current = 0
      }
      draggingOut.current = false
    })
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

  const groups = useMemo(
    () => groupBySection(filtered, state.settings.activeSection),
    [filtered, state.settings.activeSection]
  )

  useEffect(() => {
    if (selected.size === 0) return
    const list = listRef.current
    if (!list) return
    const lastId = [...selected][selected.size - 1]
    const card = list.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(lastId)}"]`)
    if (!card) return
    const listRect = list.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    if (cardRect.bottom <= listRect.bottom && cardRect.top >= listRect.top) return
    card.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [selected])

  async function refresh(): Promise<void> {
    setState(await window.tars.getState())
  }

  function patchSettings(partial: Parameters<typeof window.tars.setSettings>[0]): void {
    void window.tars.setSettings(partial).then((settings) => {
      setState((prev) => ({ ...prev, settings }))
    })
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

  async function onSubmit(event?: FormEvent): Promise<void> {
    event?.preventDefault()
    const text = draft.trim()
    const parsed = parseSectionPrefix(text)
    if (text.startsWith('##') && parsed.section !== undefined && !parsed.text && pendingFiles.length === 0) {
      await window.tars.setSettings({ activeSection: parsed.section })
      setDraft('')
      await refresh()
      return
    }
    if (!text && pendingFiles.length === 0) return
    await window.tars.addItem(text || 'Image', pendingFiles.length ? 'file' : 'note', {
      attachments: pendingFiles
    })
    setDraft('')
    setPendingFiles([])
    await refresh()
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void onSubmit()
    }
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

  async function onDropFiles(event: DragEvent): Promise<void> {
    const dt = event.dataTransfer
    if (!dt) return

    const fromList = Array.from(dt.files)
    const fromItems: File[] = []
    if (dt.items?.length) {
      for (const item of Array.from(dt.items)) {
        if (item.kind !== 'file') continue
        const file = item.getAsFile()
        if (file) fromItems.push(file)
      }
    }
    const files = fromList.length ? fromList : fromItems
    if (files.length) {
      const withPath: string[] = []
      const blobs: File[] = []
      for (const file of files) {
        const filePath = window.tars.getPathForFile(file)
        if (filePath) withPath.push(filePath)
        else blobs.push(file)
      }
      if (withPath.length) {
        await queueAttachments(await window.tars.importPaths(withPath))
      }
      if (blobs.length) {
        const saved: CooperAttachment[] = []
        for (const file of blobs) {
          const buffer = await file.arrayBuffer()
          saved.push(
            await window.tars.saveBuffer({
              bytes: buffer,
              fileName: file.name || `drop-${Date.now()}`,
              mime: file.type || undefined
            })
          )
        }
        await queueAttachments(saved)
      }
      return
    }

    const uriList = dt.getData('text/uri-list') || dt.getData('text')
    const paths = uriList
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && /^(file:\/\/|[a-zA-Z]:[\\/]|\\\\)/.test(line))
      .map((line) => {
        try {
          return decodeURIComponent(line.replace(/^file:\/\//, '').replace(/^\/([A-Za-z]:)/, '$1'))
        } catch {
          return ''
        }
      })
      .filter(Boolean)
    if (paths.length) {
      await queueAttachments(await window.tars.importPaths(paths))
    }
  }

  function onCardDragStart(event: DragEvent<HTMLElement>, item: CooperItem): void {
    const bundle = selected.has(item.id)
      ? state.items.filter((entry) => selected.has(entry.id))
      : [item]
    const texts = bundle.map(itemCopyText).filter(Boolean)
    const attachments = bundle.flatMap((entry) => entry.attachments)
    const dt = event.dataTransfer

    draggingOut.current = true

    const loaded = attachments.filter((file) => attachmentData.has(file.path))
    if (attachments.length && loaded.length < attachments.length) {
      // Nothing to hand Chromium yet, so fall back to the OS drag. Chromium must abandon
      // its own drag first, and a prevented dragstart never produces a dragend.
      event.preventDefault()
      window.tars.startDrag({ files: attachments.map((file) => file.path) })
      armDragOutTimeout()
      void Promise.all(attachments.map((file) => readAttachment(file.path)))
      return
    }

    // Chat composers reject drops whose allowed effects don't include the one they ask for.
    dt.effectAllowed = 'all'

    for (const file of loaded) {
      const buffer = attachmentBuffer(file.path)
      if (!buffer) continue
      try {
        dt.items.add(new File([buffer], file.name, { type: file.mime }))
      } catch {
        // Some targets still get the file through the uri-list/DownloadURL entries below.
      }
    }

    if (loaded.length) {
      dt.setData('text/uri-list', loaded.map((file) => pathToFileUrl(file.path)).join('\r\n'))
      // DownloadURL carries a single file, but it is what lets Chromium targets
      // materialise it under its real name instead of the on-disk uuid.
      if (loaded.length === 1) {
        const file = loaded[0]
        dt.setData('DownloadURL', `${file.mime}:${file.name}:${pathToFileUrl(file.path)}`)
      }
    }

    // A drag carrying no data at all is refused by every target, so always send something.
    const text =
      (texts.length
        ? texts.map((line) => `- ${line}`).join('\n')
        : attachments.map((file) => file.path).join('\n')) || item.text.trim()
    if (text) {
      dt.setData('text/plain', text)
      dt.setData('text', text)
    }

    const html = [
      ...texts.map((line) => `<div>${escapeHtml(line)}</div>`),
      ...loaded
        .filter(isImageAttachment)
        .map(
          (file) =>
            `<img src="${attachmentData.get(file.path)}" alt="${escapeHtml(file.name)}" />`
        )
    ].join('')
    if (html) dt.setData('text/html', html)
  }

  function prefetchAttachments(item: CooperItem): void {
    const bundle = selected.has(item.id)
      ? state.items.filter((entry) => selected.has(entry.id))
      : [item]
    for (const file of bundle.flatMap((entry) => entry.attachments)) {
      // Big files stay on the OS drag path rather than being base64'd into memory.
      if (file.size > MAX_INLINE_DRAG_BYTES) continue
      if (!attachmentData.has(file.path)) void readAttachment(file.path)
    }
  }

  function armDragOutTimeout(): void {
    if (dragOutTimer.current) window.clearTimeout(dragOutTimer.current)
    dragOutTimer.current = window.setTimeout(() => {
      draggingOut.current = false
      dragOutTimer.current = 0
    }, 15000)
  }

  function onCardDragEnd(): void {
    draggingOut.current = false
  }

  function isIncomingFileDrag(event: DragEvent): boolean {
    if (draggingOut.current) return false
    return Array.from(event.dataTransfer?.types ?? []).some(
      (type) => type === 'Files' || type === 'text/uri-list'
    )
  }

  return (
    <div
      className="app"
      data-theme={state.settings.theme === 'dark' ? 'dark' : 'light'}
      style={{
        ['--text-scale' as string]: String((state.settings.fontSize || 14) / 14)
      }}
      onPaste={(e) => void onPaste(e)}
      onDragEnter={(e) => {
        e.preventDefault()
        if (!isIncomingFileDrag(e)) return
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        if (!isIncomingFileDrag(e) && !dragging) return
        dragDepth.current -= 1
        if (dragDepth.current <= 0) {
          dragDepth.current = 0
          setDragging(false)
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        if (isIncomingFileDrag(e)) e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        if (draggingOut.current) return
        void onDropFiles(e)
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
                patchSettings({ alwaysOnTop: !state.settings.alwaysOnTop })
              }}
            >
              {state.settings.alwaysOnTop ? 'Unpin window' : 'Always on top'}
            </button>
            <div className="menu-label">Appearance</div>
            <div className="menu-pills">
              <button
                type="button"
                className={state.settings.theme !== 'dark' ? 'on' : ''}
                onClick={() => patchSettings({ theme: 'light' })}
              >
                Light
              </button>
              <button
                type="button"
                className={state.settings.theme === 'dark' ? 'on' : ''}
                onClick={() => patchSettings({ theme: 'dark' })}
              >
                Dark
              </button>
            </div>
            <div className="menu-label">Text size</div>
            <div className="menu-stepper">
              <button
                type="button"
                aria-label="Decrease text size"
                disabled={(state.settings.fontSize || 14) <= MIN_FONT_SIZE}
                onClick={() =>
                  patchSettings({ fontSize: (state.settings.fontSize || 14) - 1 })
                }
              >
                A−
              </button>
              <span>{state.settings.fontSize || 14}</span>
              <button
                type="button"
                aria-label="Increase text size"
                disabled={(state.settings.fontSize || 14) >= MAX_FONT_SIZE}
                onClick={() =>
                  patchSettings({ fontSize: (state.settings.fontSize || 14) + 1 })
                }
              >
                A+
              </button>
            </div>
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

        <div className="list" ref={listRef} onClick={() => setMenuOpen(false)}>
          {groups.length === 0 ? (
            <div className="empty">
              Select text anywhere and tap Shift twice.
              <br />
              Snip the screen to mark it up, or drop a file below.
            </div>
          ) : (
            groups.map((group) => (
              <section className="section" key={group.section}>
                <div className="section-head">
                  <span>{group.section}</span>
                </div>
                <div className="cards">
                  {group.items.length === 0 ? (
                    <div className="section-empty">Notes in this section land here</div>
                  ) : (
                    group.items.map((item) => (
                    <article
                      key={item.id}
                      data-item-id={item.id}
                      className={`card${selected.has(item.id) ? ' selected' : ''}${item.done ? ' done' : ''}`}
                      draggable
                      onClick={() => toggleSelected(item.id)}
                      onPointerDown={() => prefetchAttachments(item)}
                      onDragStart={(e) => onCardDragStart(e, item)}
                      onDragEnd={onCardDragEnd}
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
                    ))
                  )}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="dock">
          {selected.size > 0 ? (
            <div className="selection-bar">
              <span>
                {selected.size} selected
                <em className="selection-hint">Copy or drag into chat</em>
              </span>
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
            {state.settings.activeSection ? (
              <div className="active-section">
                <span>
                  Adding to <strong>{state.settings.activeSection}</strong>
                </span>
                <button
                  type="button"
                  title="Back to Inbox"
                  onClick={() => void window.tars.setSettings({ activeSection: '' }).then(refresh)}
                >
                  ×
                </button>
              </div>
            ) : null}
            <form className="composer" onSubmit={(e) => void onSubmit(e)}>
              <button type="submit" className="circle add" aria-label="Add note" title="Add">
                <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
                  <path
                    d="M12 5v14M5 12h14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <textarea
                value={draft}
                rows={1}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder={
                  pasteHint
                    ? 'Image pasted — add note & send'
                    : state.settings.activeSection
                      ? `Add to ${state.settings.activeSection}  ·  ##Name for a new section`
                      : 'Add a note  ·  ##Work to create a section'
                }
              />
              <div className="composer-actions">
                <button
                  type="button"
                  className="icon-quiet"
                  title="Snip screen (Ctrl/⌘⇧X)"
                  aria-label="Snip screen"
                  onClick={() => void window.tars.startSnip()}
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden>
                    <path
                      d="M6 3v13a2 2 0 0 0 2 2h13M18 21V8a2 2 0 0 0-2-2H3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className="icon-quiet"
                  title="Attach files"
                  onClick={() => void attachFiles()}
                >
                  📎
                </button>
              </div>
            </form>
          </div>
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
