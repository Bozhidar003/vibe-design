interface EnrichedContext {
  intent: {
    rawText: string
    quickAction?: string
    augmentedIntent?: string
  }
  target: {
    componentName: string | null
    filePath: string | null
    lineNumber: number | null
    isSharedComponent: boolean
    usageCount: number
    usageLocations: string[]
    fiberResolutionMethod: string
  }
  currentState: {
    className: string
    computedStyles: Record<string, string>
    inheritedStyles: Record<string, string | undefined>
  }
  designContext: {
    relevantTokens: Array<{ name: string; value: string }>
    conventionViolations: string[]
    availableVariants?: string[]
  }
  structuralContext: {
    parentComponent: {
      name: string | null
      className: string
      computedLayout: Record<string, string | undefined>
    }
    siblings: Array<{
      componentName: string | null
      className: string
      tagName: string
    }>
    containerInfo: string
  }
  constraints: {
    tailwindOnly: boolean
    keepAccessible: boolean
    allowNewDependencies: boolean
    allowNewFiles: boolean
  }
  screenshots?: {
    elementCrop: string
    viewportWithBoundingBox: string
  }
}

export function renderDesignTask(ctx: EnrichedContext): string {
  const lines: string[] = []
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  lines.push('# Design Task')
  lines.push(`Generated: ${now}`)
  lines.push('Status: pending')
  lines.push('')

  // ── Intent ──
  lines.push('## Design Intent')
  lines.push(`"${ctx.intent.rawText}"`)
  lines.push('')

  if (ctx.intent.augmentedIntent && ctx.intent.augmentedIntent !== ctx.intent.rawText) {
    const enrichmentPart = ctx.intent.augmentedIntent.split('\n').slice(1).join('\n')
    if (enrichmentPart.trim()) {
      lines.push(enrichmentPart.trim())
      lines.push('')
    }
  }

  if (ctx.intent.quickAction) {
    lines.push(`Quick action: ${ctx.intent.quickAction}`)
  }

  lines.push('Constraints:')
  lines.push(`- [${ctx.constraints.tailwindOnly ? 'x' : ' '}] Tailwind only (no new CSS files)`)
  lines.push(`- [${ctx.constraints.keepAccessible ? 'x' : ' '}] Keep WCAG AA contrast`)
  lines.push(`- [${ctx.constraints.allowNewDependencies ? 'x' : ' '}] Allow new dependencies`)
  lines.push(`- [${ctx.constraints.allowNewFiles ? 'x' : ' '}] Allow new files`)
  lines.push('')

  // ── Target ──
  lines.push('## Target Component')
  const name = ctx.target.componentName || 'Unknown'
  const path = ctx.target.filePath
    ? `\`${ctx.target.filePath}${ctx.target.lineNumber ? ':' + ctx.target.lineNumber : ''}\``
    : '`unresolved`'
  lines.push(`**${name}** · ${path}`)
  lines.push(`Resolution method: ${ctx.target.fiberResolutionMethod}`)

  if (ctx.target.isSharedComponent) {
    lines.push(`Shared component: yes — used in ${ctx.target.usageCount} files`)
    if (ctx.target.usageLocations.length > 0) {
      lines.push(`Usage locations: ${ctx.target.usageLocations.join(', ')}`)
    }
  }
  lines.push('')

  // ── Current Styling ──
  lines.push('## Current Styling State')
  lines.push(`**Classes:** \`${ctx.currentState.className || 'none'}\``)
  lines.push('')

  lines.push('**Computed Styles:**')
  lines.push('| Property | Value |')
  lines.push('|----------|-------|')

  const styleKeys = [
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'color', 'textAlign', 'padding', 'margin', 'gap',
    'display', 'flexDirection', 'alignItems', 'justifyContent',
    'backgroundColor', 'borderRadius', 'border', 'boxShadow', 'opacity',
    'width', 'height',
  ]

  for (const key of styleKeys) {
    const value = ctx.currentState.computedStyles[key]
    if (value && value !== 'none' && value !== 'normal' && value !== '0px') {
      lines.push(`| ${camelToKebab(key)} | ${value} |`)
    }
  }
  lines.push('')

  // Inherited styles
  const inherited = Object.entries(ctx.currentState.inheritedStyles).filter(
    ([, v]) => v !== undefined
  )
  if (inherited.length > 0) {
    lines.push('**Inherited from parent:**')
    lines.push('| Property | Value |')
    lines.push('|----------|-------|')
    for (const [key, value] of inherited) {
      lines.push(`| ${camelToKebab(key)} | ${value} |`)
    }
    lines.push('')
  }

  // ── Structural Context ──
  lines.push('## Structural Context')
  const parent = ctx.structuralContext.parentComponent
  if (parent.name || parent.className) {
    lines.push(`**Parent:** ${parent.name ? `\`<${parent.name}>\`` : ''} · \`${parent.className}\``)
  }
  if (ctx.structuralContext.siblings.length > 0) {
    const siblingDesc = ctx.structuralContext.siblings
      .map((s) => `${s.componentName || s.tagName}`)
      .join(', ')
    lines.push(`**Siblings:** ${siblingDesc}`)
  }
  lines.push(`**Container:** ${ctx.structuralContext.containerInfo}`)
  lines.push('')

  // ── Design Context ──
  if (ctx.designContext.relevantTokens.length > 0) {
    lines.push('## Design System Context')
    lines.push(
      `**Relevant tokens:** ${ctx.designContext.relevantTokens.map((t) => `${t.name} (${t.value})`).join(', ')}`
    )
    lines.push('')
  }

  if (ctx.designContext.conventionViolations.length > 0) {
    lines.push('**Convention violations:**')
    for (const v of ctx.designContext.conventionViolations) {
      lines.push(`- ${v}`)
    }
    lines.push('')
  }

  // ── Visual Context ──
  if (ctx.screenshots) {
    lines.push('## Visual Context')
    lines.push('![Element screenshot](.vibe/screenshots/element-crop.png)')
    lines.push('![Viewport context](.vibe/screenshots/viewport.png)')
    lines.push('')
  } else {
    lines.push('## Visual Context')
    lines.push('Not included — text context only.')
    lines.push('')
  }

  // ── Skills Reference ──
  lines.push('## Applicable Skills')
  lines.push('Read before making changes:')
  lines.push('- .vibe/skills/TAILWIND.md — design tokens and spacing conventions')
  lines.push('- .vibe/skills/COMPONENTS.md — component patterns and CVA conventions')
  lines.push('- .vibe/skills/CONVENTIONS.md — project-specific rules')
  lines.push('')

  return lines.join('\n')
}

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase()
}
