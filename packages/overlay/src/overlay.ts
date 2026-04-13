import { OVERLAY_STYLES } from './styles.js'
import { resolveComponent } from './fiber.js'
import { buildEnrichedContext, extractDesignStyles } from './enricher.js'
import { captureScreenshots } from './screenshots.js'
import type { EnrichedContext, QuickAction, VibeStatus } from './types.js'

// ─── Quick Actions ──────────────────────────────────────────
const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Typography', icon: 'T', prompt: 'Audit and fix typography. Reference design tokens from tailwind.config.' },
  { label: 'Color', icon: '◉', prompt: 'Improve color usage for better visual hierarchy. Reference design tokens.' },
  { label: 'Spacing', icon: '⊞', prompt: "Audit and fix spacing inconsistencies using the project's spacing scale." },
  { label: 'Animation', icon: '◎', prompt: 'Add tasteful transition/animation. Use existing motion conventions if any.' },
  { label: 'Responsive', icon: '▣', prompt: 'Add responsive variants for sm/md/lg breakpoints.' },
  { label: 'Dark mode', icon: '◐', prompt: 'Add dark: variant classes maintaining contrast ratios.' },
  { label: 'Extract variant', icon: '⧉', prompt: 'Refactor repeated class combinations into a CVA variant definition.' },
  { label: 'Accessibility', icon: '♿', prompt: 'Audit for WCAG AA compliance. Fix contrast, focus states, aria labels.' },
]

// ─── Vibe Server URL ────────────────────────────────────────
// Talk directly to the vibe server — don't rely on framework rewrites
const VIBE_PORT = 2337
const VIBE_URL = `http://${location.hostname}:${VIBE_PORT}`

// ─── State ──────────────────────────────────────────────────
let designMode = false
let selectedEl: HTMLElement | null = null
let hoveredEl: HTMLElement | null = null
let shadow: ShadowRoot
let container: HTMLElement
let activeQuickAction: string | null = null
let ws: WebSocket | null = null
let currentStatus: VibeStatus | null = null

// Multi-select state
const multiSelection = new Set<HTMLElement>()
let isMultiSelectMode = false

// ─── Shadow DOM Init ────────────────────────────────────────
function initOverlay(): void {
  const host = document.createElement('div')
  host.id = 'vibe-design-host'
  host.style.cssText = 'position:fixed; z-index:2147483647; top:0; left:0; width:0; height:0; pointer-events:none;'
  document.body.appendChild(host)

  shadow = host.attachShadow({ mode: 'closed' })

  const style = document.createElement('style')
  style.textContent = OVERLAY_STYLES
  shadow.appendChild(style)

  container = document.createElement('div')
  container.id = 'vibe-overlay-root'
  shadow.appendChild(container)

  // Global event delegation for all overlay interactions
  container.addEventListener('mousedown', (e) => {
    const target = e.target as HTMLElement
    console.log('[vibe-design] container mousedown on:', target?.tagName, target?.className)
    if (!target) return

    const action = target.closest('[data-action]') as HTMLElement
    console.log('[vibe-design] closest action:', action?.dataset?.action)
    if (!action) return

    e.stopPropagation()
    const actionName = action.dataset.action
    console.log('[vibe-design] executing action:', actionName)

    if (actionName === 'submit') {
      e.preventDefault()
      submitTask()
    } else if (actionName === 'close') {
      closePanel()
    } else if (actionName === 'toggle-preview') {
      togglePreview(action)
    } else if (actionName === 'quick') {
      handleQuickAction(action)
    }
  })

  renderFAB()
  initKeyboardShortcuts()
  connectWebSocket()

  // Expose debug helper
  ;(window as any).__vibeDesign = {
    submitTask,
    getSelectedEl: () => selectedEl,
    getMultiSelection: () => multiSelection,
  }
}

// ─── WebSocket Connection ───────────────────────────────────
function connectWebSocket(): void {
  // Try direct connection to vibe server first (port 2337),
  // then fall back to proxied path. Next.js rewrites don't support WS upgrades.
  const urls = [
    `ws://${location.hostname}:2337/ws`,
    `ws://${location.host}/__vibe/ws`,
  ]

  tryConnect(urls, 0)
}

function tryConnect(urls: string[], idx: number): void {
  if (idx >= urls.length) return

  try {
    ws = new WebSocket(urls[idx])

    ws.onopen = () => {
      // Connected successfully
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as VibeStatus
        currentStatus = msg
        updateStatusBar()
      } catch {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      setTimeout(() => tryConnect(urls, 0), 3000)
    }

    ws.onerror = () => {
      ws?.close()
      // Try next URL
      tryConnect(urls, idx + 1)
    }
  } catch {
    tryConnect(urls, idx + 1)
  }
}

// ─── FAB Button ─────────────────────────────────────────────
function renderFAB(): void {
  const existing = container.querySelector('.vibe-fab')
  if (existing) existing.remove()

  const fab = document.createElement('button')
  fab.className = `vibe-fab${designMode ? ' active' : ''}`
  fab.textContent = designMode ? '✕' : '🎨'
  fab.title = `Toggle Design Mode (${isMac() ? '⌘' : 'Ctrl'}+D)`
  fab.onclick = () => toggleDesignMode()
  container.appendChild(fab)
}

// ─── Keyboard Shortcuts ─────────────────────────────────────
function initKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    const modKey = isMac() ? e.metaKey : e.ctrlKey

    if (modKey && e.key === 'd') {
      e.preventDefault()
      toggleDesignMode()
    }

    if (modKey && e.key === 'Enter' && (selectedEl || multiSelection.size > 0)) {
      e.preventDefault()
      submitTask()
    }

    if (e.key === 'Escape') {
      if (selectedEl || multiSelection.size > 0) {
        closePanel()
      } else if (designMode) {
        toggleDesignMode()
      }
    }
  })
}

// ─── Design Mode Toggle ────────────────────────────────────
function toggleDesignMode(): void {
  designMode = !designMode
  renderFAB()

  if (designMode) {
    document.addEventListener('mousemove', onHover, { capture: true })
    document.addEventListener('click', onSelect, { capture: true })
    document.body.style.cursor = 'crosshair'
  } else {
    document.removeEventListener('mousemove', onHover, true)
    document.removeEventListener('click', onSelect, true)
    document.body.style.cursor = ''
    clearHighlights()
    closePanel()
    clearMultiSelection()
  }
}

// ─── Element Picker ─────────────────────────────────────────
function onHover(e: MouseEvent): void {
  if (!designMode) return

  const target = e.target as HTMLElement
  if (!target || target.id === 'vibe-design-host') return
  if (isInsideOverlay(target)) return

  if (target === hoveredEl) return
  hoveredEl = target

  // When multi-selecting, keep existing highlights
  if (!isMultiSelectMode) {
    clearHighlights()
  } else {
    // Remove only the hover highlight, keep selection highlights
    container.querySelectorAll('.vibe-highlight-hover, .vibe-label-hover').forEach(el => el.remove())
  }

  highlightElement(target, isMultiSelectMode ? 'hover' : undefined)
  showComponentLabel(target, isMultiSelectMode ? 'hover' : undefined)
}

function onSelect(e: MouseEvent): void {
  if (!designMode) return

  const target = e.target as HTMLElement
  if (!target || isInsideOverlay(target)) return

  e.preventDefault()
  e.stopPropagation()

  // Shift+Click: multi-select mode
  if (e.shiftKey) {
    isMultiSelectMode = true

    if (multiSelection.has(target)) {
      // Deselect
      multiSelection.delete(target)
    } else {
      multiSelection.add(target)
    }

    // Also include previously selected single element
    if (selectedEl && !multiSelection.has(selectedEl)) {
      multiSelection.add(selectedEl)
    }

    redrawMultiSelection()

    if (multiSelection.size > 0) {
      openMultiSelectPanel()
    } else {
      closePanel()
      isMultiSelectMode = false
    }
    return
  }

  // Regular click: single-select
  isMultiSelectMode = false
  clearMultiSelection()
  clearHighlights()
  highlightElement(target)
  openPromptPanel(target)
  selectedEl = target  // Must be AFTER openPromptPanel (which calls closePanel → resets selectedEl)
}

function isInsideOverlay(el: HTMLElement): boolean {
  let current: Node | null = el
  while (current) {
    if (current instanceof HTMLElement && current.id === 'vibe-design-host') return true
    current = current.parentNode
  }
  return false
}

// ─── Multi-select helpers ───────────────────────────────────
function clearMultiSelection(): void {
  multiSelection.clear()
  isMultiSelectMode = false
}

function redrawMultiSelection(): void {
  clearHighlights()
  for (const el of multiSelection) {
    highlightElement(el, 'multi')
    showComponentLabel(el, 'multi')
  }
}

// ─── Highlight ──────────────────────────────────────────────
function highlightElement(el: HTMLElement, variant?: 'hover' | 'multi'): void {
  const rect = el.getBoundingClientRect()
  const highlight = document.createElement('div')
  highlight.className = variant === 'hover'
    ? 'vibe-highlight vibe-highlight-hover'
    : variant === 'multi'
      ? 'vibe-highlight vibe-highlight-multi'
      : 'vibe-highlight'
  highlight.style.top = `${rect.top}px`
  highlight.style.left = `${rect.left}px`
  highlight.style.width = `${rect.width}px`
  highlight.style.height = `${rect.height}px`
  container.appendChild(highlight)
}

function showComponentLabel(el: HTMLElement, variant?: 'hover' | 'multi'): void {
  const identity = resolveComponent(el)
  const rect = el.getBoundingClientRect()

  const label = document.createElement('div')
  label.className = variant === 'hover'
    ? 'vibe-label vibe-label-hover'
    : variant === 'multi'
      ? 'vibe-label vibe-label-multi'
      : 'vibe-label'

  const name = identity.componentName || el.tagName.toLowerCase()
  const path = identity.filePath
    ? `${identity.filePath}${identity.lineNumber ? ':' + identity.lineNumber : ''}`
    : ''

  label.innerHTML = `<span class="vibe-label-name">${escapeHtml(name)}</span>${
    path ? `<span class="vibe-label-path">${escapeHtml(path)}</span>` : ''
  }`

  label.style.top = `${Math.max(4, rect.top - 28)}px`
  label.style.left = `${rect.left}px`

  container.appendChild(label)
}

function clearHighlights(): void {
  container.querySelectorAll('.vibe-highlight, .vibe-label').forEach((el) => el.remove())
}

// ─── Prompt Panel (Single Select) ──────────────────────────
function openPromptPanel(el: HTMLElement): void {
  closePanel()

  const identity = resolveComponent(el)
  const styles = extractDesignStyles(el)
  const className = el.className || ''

  highlightElement(el)

  const panel = document.createElement('div')
  panel.className = 'vibe-panel'
  panel.innerHTML = buildPanelHTML(identity, styles, className, false)

  container.appendChild(panel)
  wirePanel(panel, el)

  const textarea = panel.querySelector('.vibe-textarea') as HTMLTextAreaElement
  textarea?.focus()
}

// ─── Multi-Select Panel ────────────────────────────────────
function openMultiSelectPanel(): void {
  closePanel()

  const elements = Array.from(multiSelection)
  const identities = elements.map(el => resolveComponent(el))

  const panel = document.createElement('div')
  panel.className = 'vibe-panel'

  // Build multi-select header
  const names = identities
    .map((id, i) => id.componentName || elements[i].tagName.toLowerCase())
    .join(', ')

  panel.innerHTML = `
    <div class="vibe-panel-header">
      <div class="vibe-panel-header-icon">🎯</div>
      <div class="vibe-panel-header-info">
        <div class="vibe-panel-header-name">${elements.length} elements selected</div>
        <div class="vibe-panel-header-path">${escapeHtml(truncate(names, 80))}</div>
        <div class="vibe-panel-header-usages">Shift+click to add/remove elements</div>
      </div>
      <button class="vibe-panel-close" data-action="close">&times;</button>
    </div>
    <div class="vibe-panel-body">
      <div class="vibe-multi-select-list">
        ${elements.map((el, i) => {
          const id = identities[i]
          const name = id.componentName || el.tagName.toLowerCase()
          const cls = el.className?.split(' ').slice(0, 3).join(' ') || ''
          return `<div class="vibe-multi-item">
            <span class="vibe-label-name">${escapeHtml(name)}</span>
            <span class="vibe-meta-tag">${escapeHtml(truncate(cls, 40))}</span>
          </div>`
        }).join('')}
      </div>

      <div class="vibe-section-label">Quick Actions</div>
      <div class="vibe-quick-actions">
        ${QUICK_ACTIONS.map(
          (a) => `<button class="vibe-quick-btn" data-action="quick" data-prompt="${escapeAttr(a.prompt)}" data-label="${escapeAttr(a.label)}">${a.icon} ${a.label}</button>`
        ).join('')}
      </div>

      <textarea class="vibe-textarea" placeholder="Describe what you want to change across all selected elements..."></textarea>

      <div class="vibe-constraints">
        <label class="vibe-constraint">
          <input type="checkbox" data-constraint="tailwindOnly" checked> Tailwind only
        </label>
        <label class="vibe-constraint">
          <input type="checkbox" data-constraint="keepAccessible" checked> Keep accessible
        </label>
        <label class="vibe-constraint">
          <input type="checkbox" data-constraint="allowNewFiles"> Allow new files
        </label>
        <label class="vibe-constraint">
          <input type="checkbox" data-constraint="allowNewDependencies"> Allow new deps
        </label>
      </div>

      <div class="vibe-preview-toggle" data-action="toggle-preview">▸ Preview enriched prompt</div>
      <div class="vibe-preview-content" style="display:none;"></div>
    </div>
    <div class="vibe-panel-footer">
      <label class="vibe-screenshot-toggle">
        <input type="checkbox" data-constraint="screenshots"> Include screenshots
      </label>
      <button class="vibe-submit-btn" data-action="submit">
        Send to Claude Code <span class="vibe-submit-kbd">${isMac() ? '⌘' : 'Ctrl'}↵</span>
      </button>
    </div>
    <div class="vibe-status-bar" style="display:none;">
      <span class="vibe-status-dot"></span>
      <span class="vibe-status-message"></span>
    </div>
  `

  container.appendChild(panel)
  wirePanelMulti(panel, elements)

  const textarea = panel.querySelector('.vibe-textarea') as HTMLTextAreaElement
  textarea?.focus()
}

function buildPanelHTML(
  identity: ReturnType<typeof resolveComponent>,
  styles: ReturnType<typeof extractDesignStyles>,
  className: string,
  _isMulti: boolean
): string {
  const name = identity.componentName || 'Unknown Element'
  const path = identity.filePath || 'File not resolved'
  const line = identity.lineNumber ? `:${identity.lineNumber}` : ''
  const method = identity.method

  const fontInfo = `${parseFloat(styles.fontSize)}px · ${styles.fontWeight} weight · ${styles.color}`
  const parentEl = selectedEl?.parentElement
  const parentTag = parentEl?.tagName.toLowerCase() || 'unknown'
  const parentClasses = parentEl?.className?.split(' ').slice(0, 5).join(' ') || ''

  return `
    <div class="vibe-panel-header">
      <div class="vibe-panel-header-icon">🎯</div>
      <div class="vibe-panel-header-info">
        <div class="vibe-panel-header-name">${escapeHtml(name)}</div>
        <div class="vibe-panel-header-path">${escapeHtml(path)}${line}</div>
        <div class="vibe-panel-header-usages">Resolution: ${method}</div>
      </div>
      <button class="vibe-panel-close" data-action="close">&times;</button>
    </div>
    <div class="vibe-panel-body">
      ${className ? `<div class="vibe-classes-row">${escapeHtml(truncate(className, 120))}</div>` : ''}
      <div class="vibe-meta-row">
        <span class="vibe-meta-tag computed">${escapeHtml(fontInfo)}</span>
      </div>
      <div class="vibe-meta-row">
        <span class="vibe-meta-tag parent">&lt;${escapeHtml(parentTag)}&gt; ${escapeHtml(truncate(parentClasses, 60))}</span>
      </div>

      <div class="vibe-section-label">Quick Actions</div>
      <div class="vibe-quick-actions">
        ${QUICK_ACTIONS.map(
          (a) => `<button class="vibe-quick-btn" data-action="quick" data-prompt="${escapeAttr(a.prompt)}" data-label="${escapeAttr(a.label)}">${a.icon} ${a.label}</button>`
        ).join('')}
      </div>

      <textarea class="vibe-textarea" placeholder="Describe what you want to change..."></textarea>

      <div class="vibe-constraints">
        <label class="vibe-constraint">
          <input type="checkbox" data-constraint="tailwindOnly" checked> Tailwind only
        </label>
        <label class="vibe-constraint">
          <input type="checkbox" data-constraint="keepAccessible" checked> Keep accessible
        </label>
        <label class="vibe-constraint">
          <input type="checkbox" data-constraint="allowNewFiles"> Allow new files
        </label>
        <label class="vibe-constraint">
          <input type="checkbox" data-constraint="allowNewDependencies"> Allow new deps
        </label>
      </div>

      <div class="vibe-preview-toggle" data-action="toggle-preview">▸ Preview enriched prompt</div>
      <div class="vibe-preview-content" style="display:none;"></div>
    </div>
    <div class="vibe-panel-footer">
      <label class="vibe-screenshot-toggle">
        <input type="checkbox" data-constraint="screenshots"> Include screenshots
      </label>
      <button class="vibe-submit-btn" data-action="submit">
        Send to Claude Code <span class="vibe-submit-kbd">${isMac() ? '⌘' : 'Ctrl'}↵</span>
      </button>
    </div>
    <div class="vibe-status-bar" style="display:none;">
      <span class="vibe-status-dot"></span>
      <span class="vibe-status-message"></span>
    </div>
  `
}

// ─── Panel Wiring ──────────────────────────────────────────
// All action handlers are now delegated via the container-level
// mousedown listener in initOverlay(). These functions only
// set up non-action listeners (textarea input for preview).

function wirePanel(_panel: HTMLElement, _el: HTMLElement): void {
  // Textarea input for live preview — not an action button
  const textarea = _panel.querySelector('.vibe-textarea') as HTMLTextAreaElement
  textarea?.addEventListener('input', () => updatePreview(_panel, _el))
}

function wirePanelMulti(_panel: HTMLElement, _elements: HTMLElement[]): void {
  // No special wiring needed — delegation handles everything
}

// ─── Action Handlers (called from container delegation) ────
function handleQuickAction(btn: HTMLElement): void {
  const panel = container.querySelector('.vibe-panel') as HTMLElement
  if (!panel) return

  const prompt = btn.dataset.prompt || ''
  const label = btn.dataset.label || ''
  const textarea = panel.querySelector('.vibe-textarea') as HTMLTextAreaElement

  if (activeQuickAction === label) {
    activeQuickAction = null
    btn.classList.remove('active')
    if (textarea) textarea.value = ''
  } else {
    panel.querySelectorAll('.vibe-quick-btn').forEach((b) => b.classList.remove('active'))
    activeQuickAction = label
    btn.classList.add('active')
    if (textarea) textarea.value = prompt
  }
}

function togglePreview(_toggle: HTMLElement): void {
  const panel = container.querySelector('.vibe-panel') as HTMLElement
  if (!panel) return

  const content = panel.querySelector('.vibe-preview-content') as HTMLElement
  if (!content) return

  if (content.style.display === 'none') {
    content.style.display = 'block'
    _toggle.textContent = '▾ Preview enriched prompt'

    if (isMultiSelectMode && multiSelection.size > 0) {
      const contexts = gatherMultiContext(panel, Array.from(multiSelection))
      content.textContent = formatMultiPreview(contexts, panel)
    } else if (selectedEl) {
      const ctx = gatherContext(panel, selectedEl)
      content.textContent = formatPreview(ctx)
    }
  } else {
    content.style.display = 'none'
    _toggle.textContent = '▸ Preview enriched prompt'
  }
}

function updatePreview(panel: HTMLElement, el: HTMLElement): void {
  const preview = panel.querySelector('.vibe-preview-content') as HTMLElement
  if (!preview || preview.style.display === 'none') return

  const context = gatherContext(panel, el)
  preview.textContent = formatPreview(context)
}

function gatherContext(panel: HTMLElement, el: HTMLElement): EnrichedContext {
  const textarea = panel.querySelector('.vibe-textarea') as HTMLTextAreaElement
  const intentText = textarea?.value || ''

  const constraints = {
    tailwindOnly: isChecked(panel, 'tailwindOnly'),
    keepAccessible: isChecked(panel, 'keepAccessible'),
    allowNewFiles: isChecked(panel, 'allowNewFiles'),
    allowNewDependencies: isChecked(panel, 'allowNewDependencies'),
  }

  return buildEnrichedContext(el, intentText, {
    quickAction: activeQuickAction || undefined,
    constraints,
    includeScreenshots: isChecked(panel, 'screenshots'),
  })
}

function gatherMultiContext(panel: HTMLElement, elements: HTMLElement[]): EnrichedContext[] {
  const textarea = panel.querySelector('.vibe-textarea') as HTMLTextAreaElement
  const intentText = textarea?.value || ''

  const constraints = {
    tailwindOnly: isChecked(panel, 'tailwindOnly'),
    keepAccessible: isChecked(panel, 'keepAccessible'),
    allowNewFiles: isChecked(panel, 'allowNewFiles'),
    allowNewDependencies: isChecked(panel, 'allowNewDependencies'),
  }

  return elements.map(el =>
    buildEnrichedContext(el, intentText, {
      quickAction: activeQuickAction || undefined,
      constraints,
      includeScreenshots: false, // screenshots per-element not practical in multi
    })
  )
}

function isChecked(panel: HTMLElement, name: string): boolean {
  const checkbox = panel.querySelector(`[data-constraint="${name}"]`) as HTMLInputElement
  return checkbox?.checked ?? false
}

function formatPreview(ctx: EnrichedContext): string {
  const lines: string[] = []

  lines.push('# Design Task')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('Status: pending')
  lines.push('')

  lines.push('## Design Intent')
  lines.push(`"${ctx.intent.rawText}"`)
  if (ctx.intent.augmentedIntent && ctx.intent.augmentedIntent !== ctx.intent.rawText) {
    lines.push('')
    lines.push(ctx.intent.augmentedIntent.split('\n').slice(1).join('\n'))
  }
  if (ctx.intent.quickAction) {
    lines.push(`\nQuick action: ${ctx.intent.quickAction}`)
  }
  lines.push('')

  lines.push('## Target Component')
  lines.push(`**${ctx.target.componentName || 'Unknown'}** · \`${ctx.target.filePath || 'unresolved'}\``)
  lines.push(`Resolution: ${ctx.target.fiberResolutionMethod}`)
  lines.push('')

  lines.push('## Current Styling')
  lines.push(`Classes: ${ctx.currentState.className || 'none'}`)
  lines.push(`Font: ${ctx.currentState.computedStyles.fontSize} / ${ctx.currentState.computedStyles.fontWeight}`)
  lines.push(`Color: ${ctx.currentState.computedStyles.color}`)
  lines.push(`Background: ${ctx.currentState.computedStyles.backgroundColor}`)
  lines.push('')

  lines.push('## Structural Context')
  lines.push(ctx.structuralContext.containerInfo)
  lines.push('')

  lines.push('## Constraints')
  lines.push(`Tailwind only: ${ctx.constraints.tailwindOnly ? 'yes' : 'no'}`)
  lines.push(`Keep accessible: ${ctx.constraints.keepAccessible ? 'yes' : 'no'}`)

  return lines.join('\n')
}

function formatMultiPreview(contexts: EnrichedContext[], panel: HTMLElement): string {
  const textarea = panel.querySelector('.vibe-textarea') as HTMLTextAreaElement
  const intentText = textarea?.value || ''
  const lines: string[] = []

  lines.push('# Design Task (Multi-Element)')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Status: pending`)
  lines.push(`Elements: ${contexts.length}`)
  lines.push('')

  lines.push('## Design Intent')
  lines.push(`"${intentText}"`)
  lines.push('')

  for (let i = 0; i < contexts.length; i++) {
    const ctx = contexts[i]
    lines.push(`## Element ${i + 1}: ${ctx.target.componentName || 'Unknown'}`)
    lines.push(`File: ${ctx.target.filePath || 'unresolved'}`)
    lines.push(`Classes: ${ctx.currentState.className || 'none'}`)
    lines.push(`Color: ${ctx.currentState.computedStyles.color}`)
    lines.push('')
  }

  return lines.join('\n')
}

// ─── Submit Task ────────────────────────────────────────────
async function submitTask(): Promise<void> {
  console.log('[vibe-design] submitTask called')
  const panel = container.querySelector('.vibe-panel') as HTMLElement
  console.log('[vibe-design] panel:', !!panel)
  if (!panel) return

  // Determine if multi-select or single
  console.log('[vibe-design] selectedEl:', !!selectedEl, 'multiSelect:', isMultiSelectMode, 'multiSize:', multiSelection.size)
  const elements = isMultiSelectMode ? Array.from(multiSelection) : (selectedEl ? [selectedEl] : [])
  console.log('[vibe-design] elements count:', elements.length)
  if (elements.length === 0) return

  const submitBtn = panel.querySelector('.vibe-submit-btn') as HTMLButtonElement
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.textContent = 'Sending...'
  }

  try {
    let payload: any

    if (elements.length === 1) {
      // Single element
      const context = gatherContext(panel, elements[0])
      if (isChecked(panel, 'screenshots')) {
        try {
          context.screenshots = await captureScreenshots(elements[0])
        } catch (err) {
          console.warn('[vibe-design] Screenshot capture failed:', err)
        }
      }
      payload = context
    } else {
      // Multi-element: send array of contexts
      const contexts = gatherMultiContext(panel, elements)
      payload = {
        multiElement: true,
        elements: contexts,
        intent: {
          rawText: (panel.querySelector('.vibe-textarea') as HTMLTextAreaElement)?.value || '',
          quickAction: activeQuickAction || undefined,
        },
        constraints: {
          tailwindOnly: isChecked(panel, 'tailwindOnly'),
          keepAccessible: isChecked(panel, 'keepAccessible'),
          allowNewFiles: isChecked(panel, 'allowNewFiles'),
          allowNewDependencies: isChecked(panel, 'allowNewDependencies'),
        },
      }
    }

    console.log('[vibe-design] Sending task to', VIBE_URL + '/task')

    const response = await fetch(`${VIBE_URL}/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`)
    }

    const result = await response.json()
    console.log('[vibe-design] Task accepted:', result)
    showStatus(panel, 'working', 'Claude Code is working...')

    // Reset the button immediately
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.innerHTML = `Send to Claude Code <span class="vibe-submit-kbd">${isMac() ? '⌘' : 'Ctrl'}↵</span>`
    }

    // Poll for completion since WebSocket may not be connected
    pollForDone(panel)
  } catch (err) {
    showStatus(panel, 'error', `Failed: ${(err as Error).message}`)
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.innerHTML = `Send to Claude Code <span class="vibe-submit-kbd">${isMac() ? '⌘' : 'Ctrl'}↵</span>`
    }
  }
}

function pollForDone(panel: HTMLElement): void {
  let attempts = 0
  const maxAttempts = 60 // poll for up to 60 seconds
  const interval = setInterval(async () => {
    attempts++
    if (attempts > maxAttempts) {
      clearInterval(interval)
      showStatus(panel, 'done', 'Task sent (check your editor)')
      return
    }
    try {
      const resp = await fetch(`${VIBE_URL}/health`)
      if (resp.ok) {
        const data = await resp.json()
        if (data.claudeBusy === false && attempts > 2) {
          clearInterval(interval)
          showStatus(panel, 'done', 'Changes applied ✓')
        }
      }
    } catch {
      // server unreachable, keep polling
    }
  }, 1000)
}

function showStatus(panel: HTMLElement, state: string, message: string): void {
  const bar = panel.querySelector('.vibe-status-bar') as HTMLElement
  if (!bar) return

  bar.style.display = 'flex'
  bar.className = `vibe-status-bar ${state}`
  const msgEl = bar.querySelector('.vibe-status-message')
  if (msgEl) msgEl.textContent = message
}

function updateStatusBar(): void {
  if (!currentStatus) return
  const panel = container.querySelector('.vibe-panel') as HTMLElement
  if (!panel) return

  showStatus(panel, currentStatus.state, currentStatus.message || currentStatus.state)

  if (currentStatus.state === 'done') {
    const submitBtn = panel.querySelector('.vibe-submit-btn') as HTMLButtonElement
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.innerHTML = `Send to Claude Code <span class="vibe-submit-kbd">${isMac() ? '⌘' : 'Ctrl'}↵</span>`
    }
  }
}

// ─── Panel Close ────────────────────────────────────────────
function closePanel(): void {
  container.querySelectorAll('.vibe-panel').forEach((p) => p.remove())
  selectedEl = null
  activeQuickAction = null
  clearHighlights()
  if (isMultiSelectMode) {
    clearMultiSelection()
  }
}

// ─── Helpers ────────────────────────────────────────────────
function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0
}

function escapeHtml(str: string): string {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ─── Init ───────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOverlay)
  } else {
    initOverlay()
  }
}
