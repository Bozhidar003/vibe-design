import express from 'express'
import { WebSocketServer, WebSocket } from 'ws'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { exec } from 'child_process'
import { join } from 'path'
import { resolveFileFromHints } from './resolver.js'
import { renderDesignTask } from './task-writer.js'
import { loadConfig, type VibeConfig } from './config.js'

export { loadConfig, type VibeConfig } from './config.js'
export { renderDesignTask } from './task-writer.js'
export { resolveFileFromHints } from './resolver.js'

export async function createVibeServer(projectDir: string) {
  const config = await loadConfig(projectDir)
  const app = express()

  // ─── Design System ─────────────────────────────────────────
  // Persistent design decisions that inform all prompts
  let designSystemRules: string[] = []

  async function loadDesignSystem(): Promise<void> {
    try {
      const dsPath = join(projectDir, '.vibe', 'design-system.json')
      const content = await readFile(dsPath, 'utf-8')
      const ds = JSON.parse(content)
      designSystemRules = ds.rules || []
      console.log(`[vibe-design] 📐 Loaded ${designSystemRules.length} design system rules`)
    } catch {
      // No design system yet — that's fine
      designSystemRules = []
    }
  }

  async function saveDesignSystem(rules: string[]): Promise<void> {
    designSystemRules = rules
    const dsPath = join(projectDir, '.vibe', 'design-system.json')
    await mkdir(join(projectDir, '.vibe'), { recursive: true })
    await writeFile(dsPath, JSON.stringify({ rules, updatedAt: new Date().toISOString() }, null, 2))
  }

  // Load on startup
  loadDesignSystem()

  // ─── Task Execution ───────────────────────────────────────
  let busy = false

  function broadcast(state: string, message: string) {
    const data = JSON.stringify({ type: 'status', state, message })
    for (const ws of wsClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    }
  }

  function executeTask(prompt: string): void {
    if (busy) {
      console.log('[vibe-design] ⏳ Already busy, skipping')
      broadcast('working', 'Previous task still running...')
      return
    }
    busy = true
    broadcast('working', 'Claude Code is working...')

    // Write prompt to a file, then pass as argument — avoids shell escaping issues
    const promptFile = join(projectDir, '.vibe', 'tasks', '.current-prompt.txt')
    writeFile(promptFile, prompt).then(() => {
      // --dangerously-skip-permissions = full agent mode (reads + edits files)
      // Reads prompt from file to avoid shell escaping issues with quotes
      const cmd = `claude --dangerously-skip-permissions "$(cat '${promptFile}')" < /dev/null`
      console.log('[vibe-design] 🚀 Executing task...')

      const proc = exec(cmd, {
        cwd: projectDir,
        timeout: 120000,
        shell: '/bin/bash',
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      })

      proc.stdout?.on('data', (data: string) => {
        const line = data.toString().replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').trim()
        if (line) {
          console.log(`[vibe-design]    Claude: ${line.slice(0, 300)}`)
          broadcast('working', line.slice(0, 200))
        }
      })

      proc.stderr?.on('data', (data: string) => {
        const line = data.toString().trim()
        if (line && !line.includes('stdin') && !line.includes('Deprecation')) {
          console.log(`[vibe-design]    stderr: ${line.slice(0, 200)}`)
        }
      })

      proc.on('close', (code) => {
        busy = false
        if (code === 0) {
          console.log('[vibe-design] ✅ Changes applied')
          broadcast('done', 'Changes applied ✓')
        } else {
          console.log(`[vibe-design] ❌ Exit code ${code}`)
          broadcast('error', `Claude exited with code ${code}`)
        }
      })
    })
  }

  // ─── Inline Prompt Builder ────────────────────────────────
  function buildPrompt(body: any): string {
    const intent = body.intent?.rawText || ''
    const augmented = body.intent?.augmentedIntent || ''
    const t = body.target || {}
    const s = body.currentState || {}
    const ctx = body.structuralContext || {}
    const dc = body.designContext || {}
    const c = body.constraints || {}

    const lines: string[] = []

    // Intent — include augmentation if present
    lines.push(`DESIGN TASK: "${intent}"`)
    if (augmented && augmented !== intent) {
      // Extract the enrichment context part
      const enrichment = (augmented.split('[Enrichment:')[1] || augmented.split('[Enrichment context:')[1])?.replace(/\]$/, '').trim()
      if (enrichment) lines.push(`CONTEXT: ${enrichment}`)
    }
    lines.push('')

    // Target element
    const filePath = t.filePath || null
    if (filePath) {
      lines.push(`FILE: ${filePath}${t.lineNumber ? ':' + t.lineNumber : ''}`)
    } else {
      // No file resolved — give Claude hints to find it
      lines.push(`ELEMENT: <${t.tagName || 'unknown'}> with classes "${s.className || ''}"`)
      if (t.textContentHint) lines.push(`TEXT CONTENT: "${t.textContentHint}"`)
      lines.push(`(File not resolved — search the src/ directory for these classes)`)
    }

    if (t.componentName) lines.push(`COMPONENT: ${t.componentName}`)
    if (s.className) lines.push(`CLASSES: ${s.className}`)

    // Computed styles — the key ones
    const cs = s.computedStyles || {}
    const styleInfo = [cs.fontSize, cs.fontWeight, cs.color, cs.backgroundColor]
      .filter(Boolean).join(' / ')
    if (styleInfo) lines.push(`COMPUTED: ${styleInfo}`)

    // Inherited styles
    const inherited = s.inheritedStyles || {}
    if (inherited.fontSize || inherited.color) {
      lines.push(`INHERITED: fontSize=${inherited.fontSize || '?'} color=${inherited.color || '?'}`)
    }

    // Structural context
    if (ctx.containerInfo) lines.push(`LAYOUT: ${ctx.containerInfo}`)
    if (ctx.parentComponent?.className) {
      lines.push(`PARENT: <${ctx.parentComponent.name || '?'}> ${ctx.parentComponent.className}`)
    }

    // Design token violations
    if (dc.conventionViolations?.length > 0) {
      lines.push(`CONVENTION ISSUES: ${dc.conventionViolations.join('; ')}`)
    }

    // Relevant tokens
    if (dc.relevantTokens?.length > 0) {
      const tokenStr = dc.relevantTokens.map((t: any) => `${t.name}=${t.value}`).join(', ')
      lines.push(`DESIGN TOKENS: ${tokenStr}`)
    }

    // Include design system decisions if they exist
    if (designSystemRules.length > 0) {
      lines.push(`DESIGN SYSTEM: ${designSystemRules.join('; ')}`)
    }

    // Constraints
    const rules = []
    if (c.tailwindOnly) rules.push('Tailwind classes only')
    if (c.keepAccessible) rules.push('maintain WCAG AA contrast')
    if (!c.allowNewFiles) rules.push('do not create new files')
    if (rules.length) lines.push(`RULES: ${rules.join(', ')}`)

    // Page URL
    if (body.page?.url) lines.push(`PAGE: ${body.page.url}`)

    // If this is a design/aesthetic task, reference the design skill
    if (/better|improve|polish|beautiful|modern|clean|redesign|style|look|vibe|aesthetic/i.test(intent)) {
      lines.push('SKILL: Follow .claude/skills/vibe-design/FRONTEND_DESIGN.md — make it distinctive, not generic.')
    }

    lines.push('')
    lines.push('Edit the file now. Minimal change. No explanation needed.')
    return lines.join('\n')
  }

  function buildMultiPrompt(body: any): string {
    const intent = body.intent?.rawText || ''
    const elements = body.elements || []
    const lines = [`DESIGN TASK: "${intent}" — ${elements.length} elements`]
    for (const el of elements) {
      const t = el.target || {}
      const s = el.currentState || {}
      lines.push(`  - ${t.componentName || '?'} in ${t.filePath || '?'} classes: ${s.className || ''}`)
    }
    lines.push('', 'Edit the files now. Minimal changes. No explanation needed.')
    return lines.join('\n')
  }

  // ─── WebSocket clients ────────────────────────────────────
  const wsClients = new Set<WebSocket>()

  // ─── Express Setup ────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }))

  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    if (_req.method === 'OPTIONS') { res.sendStatus(200); return }
    next()
  })

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0', claudeBusy: busy })
  })

  // Design system CRUD
  app.get('/design-system', (_req, res) => {
    res.json({ rules: designSystemRules })
  })

  app.post('/design-system', async (req, res) => {
    const { rules } = req.body
    if (Array.isArray(rules)) {
      await saveDesignSystem(rules)
      res.json({ status: 'ok', rules: designSystemRules })
    } else {
      res.status(400).json({ error: 'rules must be an array of strings' })
    }
  })

  app.post('/design-system/add', async (req, res) => {
    const { rule } = req.body
    if (typeof rule === 'string' && rule.trim()) {
      designSystemRules.push(rule.trim())
      await saveDesignSystem(designSystemRules)
      res.json({ status: 'ok', rules: designSystemRules })
    } else {
      res.status(400).json({ error: 'rule must be a non-empty string' })
    }
  })

  app.get('/config', (_req, res) => {
    res.json({ overlay: config.overlay, screenshotDefault: config.screenshotDefault })
  })

  app.get('/tokens', async (_req, res) => {
    try {
      const content = await readFile(join(projectDir, '.vibe', 'skills', 'TAILWIND.md'), 'utf-8')
      const tokens: Array<{ name: string; value: string; category: string }> = []
      const sections = [
        { regex: /## Custom Colors\n([\s\S]*?)(?=\n##|\n$)/, cat: 'color' },
        { regex: /## CSS Custom Properties\n([\s\S]*?)(?=\n##|\n$)/, cat: 'color' },
        { regex: /## Custom Spacing\n([\s\S]*?)(?=\n##|\n$)/, cat: 'spacing' },
      ]
      for (const { regex, cat } of sections) {
        const sec = content.match(regex)?.[1]
        if (sec) {
          let m; const r = /- `([^`]+)`:\s*(.+)/g
          while ((m = r.exec(sec)) !== null) tokens.push({ name: m[1], value: m[2].trim(), category: cat })
        }
      }
      res.json(tokens)
    } catch { res.json([]) }
  })

  // ─── Main Task Endpoint ───────────────────────────────────
  app.post('/task', async (req, res) => {
    try {
      const body = req.body
      const isMulti = body.multiElement === true

      console.log('')
      console.log(`[vibe-design] 📩 Task: "${body.intent?.rawText || ''}"`)
      console.log(`[vibe-design]    Target: ${isMulti ? body.elements?.length + ' elements' : (body.target?.componentName || '?') + ' (' + (body.target?.filePath || '?') + ')'}`)

      // Resolve file paths
      if (isMulti) {
        for (const ctx of body.elements || []) await resolveCtx(ctx, config.detection.srcDir)
      } else {
        await resolveCtx(body, config.detection.srcDir)
      }

      // Write task for history
      const tasksDir = join(projectDir, '.vibe', 'tasks')
      await mkdir(join(tasksDir, 'history'), { recursive: true })
      try {
        const prev = await readFile(join(tasksDir, 'DESIGN_TASK.md'), 'utf-8')
        if (prev) await writeFile(join(tasksDir, 'history', `DESIGN_TASK-${Date.now()}.md`), prev)
      } catch { /* no previous */ }
      const taskMd = isMulti ? renderMultiTask(body) : renderDesignTask(body)
      await writeFile(join(tasksDir, 'DESIGN_TASK.md'), taskMd)

      // Execute
      if (config.autoTrigger) {
        const prompt = isMulti ? buildMultiPrompt(body) : buildPrompt(body)
        executeTask(prompt)
      }

      res.json({ status: 'ok', taskPath: '.vibe/tasks/DESIGN_TASK.md', busy })
    } catch (err) {
      console.error('[vibe-design] Error:', err)
      broadcast('error', (err as Error).message)
      res.status(500).json({ error: (err as Error).message })
    }
  })

  // ─── Overlay Script ───────────────────────────────────────
  app.get('/overlay.js', async (_req, res) => {
    res.header('Cache-Control', 'no-store')
    try {
      const { fileURLToPath } = await import('url')
      const { dirname } = await import('path')
      const paths = [
        join(projectDir, 'node_modules', '@vibe-design', 'overlay', 'dist', 'overlay.global.js'),
        join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'overlay', 'dist', 'overlay.global.js'),
      ]
      for (const p of paths) {
        try { res.type('application/javascript').send(await readFile(p, 'utf-8')); return } catch { continue }
      }
      res.status(404).json({ error: 'Overlay not found' })
    } catch (err) { res.status(500).json({ error: (err as Error).message }) }
  })

  // ─── Start ────────────────────────────────────────────────
  const server = app.listen(config.port, () => {
    console.log(`[vibe-design] Server on http://localhost:${config.port}`)
  })

  const wss = new WebSocketServer({ noServer: true })
  wss.on('connection', (ws) => { wsClients.add(ws); ws.on('close', () => wsClients.delete(ws)) })
  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/ws' || req.url === '/__vibe/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
    } else { socket.destroy() }
  })

  return { app, server, wss, config }
}

// ─── Helpers ────────────────────────────────────────────────
async function resolveCtx(ctx: any, srcDir: string): Promise<void> {
  if (!ctx.target?.filePath && (ctx.target?.classNameHint || ctx.target?.componentName)) {
    const resolved = await resolveFileFromHints(srcDir, {
      componentName: ctx.target.componentName,
      classNameHint: ctx.target.classNameHint,
      textContentHint: ctx.target.textContentHint,
    })
    if (resolved) { ctx.target.filePath = resolved.filePath; ctx.target.lineNumber = resolved.lineNumber }
  }
}

function renderMultiTask(body: any): string {
  const lines = ['# Design Task (Multi)', `Generated: ${new Date().toISOString()}`, '']
  lines.push(`## Intent: "${body.intent?.rawText || ''}"`, '')
  for (const el of body.elements || []) {
    lines.push(`- ${el.target?.componentName || '?'} in ${el.target?.filePath || '?'} — ${el.currentState?.className || ''}`)
  }
  return lines.join('\n')
}

async function saveBase64(data: string, path: string): Promise<void> {
  await writeFile(path, Buffer.from(data.replace(/^data:image\/\w+;base64,/, ''), 'base64'))
}
