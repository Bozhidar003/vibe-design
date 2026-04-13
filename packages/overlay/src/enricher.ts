import type { ComputedDesignStyles, EnrichedContext, ComponentIdentity } from './types.js'
import { resolveComponent } from './fiber.js'

// Cached design tokens loaded from vibe server
let cachedTokens: Array<{ name: string; value: string; category: string }> = []
let tokensLoaded = false

export async function loadDesignTokens(): Promise<void> {
  if (tokensLoaded) return
  try {
    const vibeUrl = `http://${location.hostname}:2337`
    const resp = await fetch(`${vibeUrl}/tokens`)
    if (resp.ok) {
      cachedTokens = await resp.json()
    }
  } catch {
    // Tokens not available, that's fine
  }
  tokensLoaded = true
}

// Try to load tokens on init
if (typeof window !== 'undefined') {
  loadDesignTokens()
}

export function extractDesignStyles(el: HTMLElement): ComputedDesignStyles {
  const cs = getComputedStyle(el)
  return {
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    color: cs.color,
    textAlign: cs.textAlign,
    padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
    margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
    gap: cs.gap,
    display: cs.display,
    flexDirection: cs.flexDirection,
    alignItems: cs.alignItems,
    justifyContent: cs.justifyContent,
    backgroundColor: cs.backgroundColor,
    borderRadius: cs.borderRadius,
    border: `${cs.borderWidth} ${cs.borderStyle} ${cs.borderColor}`,
    boxShadow: cs.boxShadow,
    opacity: cs.opacity,
    width: cs.width,
    height: cs.height,
  }
}

function extractInheritedStyles(
  el: HTMLElement
): EnrichedContext['currentState']['inheritedStyles'] {
  const parent = el.parentElement
  if (!parent) return {}

  const cs = getComputedStyle(parent)
  return {
    fontSize: cs.fontSize,
    color: cs.color,
    fontFamily: cs.fontFamily,
    lineHeight: cs.lineHeight,
  }
}

function buildStructuralContext(el: HTMLElement): EnrichedContext['structuralContext'] {
  const parent = el.parentElement
  const parentCs = parent ? getComputedStyle(parent) : null

  const parentIdentity = parent ? resolveComponent(parent) : null

  const siblings: EnrichedContext['structuralContext']['siblings'] = []
  if (parent) {
    for (const child of Array.from(parent.children)) {
      if (child === el) continue
      if (child.id === 'vibe-design-host') continue
      const childIdentity = resolveComponent(child as HTMLElement)
      siblings.push({
        componentName: childIdentity.componentName,
        className:
          child instanceof HTMLElement
            ? child.className.split(' ').slice(0, 5).join(' ')
            : '',
        tagName: child.tagName.toLowerCase(),
      })
    }
  }

  const parentLayout = {
    display: parentCs?.display ?? '',
    flexDirection: parentCs?.flexDirection ?? undefined,
    alignItems: parentCs?.alignItems ?? undefined,
    justifyContent: parentCs?.justifyContent ?? undefined,
    gap: parentCs?.gap ?? undefined,
    gridTemplateColumns: parentCs?.gridTemplateColumns ?? undefined,
  }

  // Build container description
  const layoutType = parentLayout.display.includes('flex')
    ? `flex-${parentLayout.flexDirection || 'row'}`
    : parentLayout.display.includes('grid')
      ? 'grid'
      : parentLayout.display
  const siblingCount = siblings.length
  const gapInfo = parentLayout.gap && parentLayout.gap !== 'normal' ? `, gap-${parentLayout.gap}` : ''
  const containerInfo = `Inside a ${layoutType} with ${siblingCount} sibling${siblingCount !== 1 ? 's' : ''}${gapInfo}`

  return {
    parentComponent: {
      name: parentIdentity?.componentName ?? null,
      className: parent?.className?.split(' ').slice(0, 8).join(' ') ?? '',
      computedLayout: parentLayout,
    },
    siblings: siblings.slice(0, 6),
    containerInfo,
  }
}

export function augmentIntent(
  rawIntent: string,
  computedStyles: ComputedDesignStyles,
  className: string
): string {
  const augmentations: string[] = []

  // ─── Always-on analysis (not keyword-gated) ───────────────
  const color = parseRgba(computedStyles.color)
  const bg = parseRgba(computedStyles.backgroundColor)

  // Contrast check — always run
  if (color && bg) {
    const contrast = getContrastRatio(color, bg)
    if (contrast < 4.5) {
      augmentations.push(`⚠ Contrast ratio: ${contrast.toFixed(1)}:1 (WCAG AA needs 4.5:1).`)
    }
  }

  // Font size analysis
  const fontSize = parseFloat(computedStyles.fontSize)
  if (fontSize < 12) {
    augmentations.push(`⚠ Very small text: ${fontSize}px.`)
  }

  // Missing hover/focus states (buttons, links)
  if (className && !className.includes('hover:') && !className.includes('focus:')) {
    const isInteractive = className.includes('cursor-pointer') ||
      className.includes('btn') ||
      /rounded.*bg-/.test(className)
    if (isInteractive) {
      augmentations.push('Missing hover/focus states — interactive element should have hover: and focus: variants.')
    }
  }

  // No border-radius on what looks like a button/card
  if (className && !className.includes('rounded') && /bg-\w/.test(className)) {
    augmentations.push('Element has background color but no border-radius.')
  }

  // ─── Keyword-triggered deeper analysis ────────────────────

  // "better" / "improve" / "polish" — give design suggestions
  if (/better|improve|polish|upgrade|enhance|nicer|modern|clean/i.test(rawIntent)) {
    const suggestions: string[] = []

    if (!className.includes('shadow')) suggestions.push('consider adding shadow-sm or shadow-md for depth')
    if (!className.includes('transition')) suggestions.push('add transition-colors or transition-all for smooth interactions')
    if (fontSize < 14) suggestions.push('consider increasing font size for readability')
    if (!className.includes('tracking')) suggestions.push('consider letter-spacing (tracking-tight or tracking-wide)')

    if (suggestions.length > 0) {
      augmentations.push(`Design suggestions: ${suggestions.join('; ')}.`)
    }
  }

  // Spacing keywords
  if (/spacing|cramped|tight|breathe|room|padding|margin|squished/i.test(rawIntent)) {
    augmentations.push(
      `Current padding: ${computedStyles.padding}. Gap: ${computedStyles.gap || 'none'}.`
    )
  }

  // Alignment keywords
  if (/align|center|middle|left|right/i.test(rawIntent)) {
    augmentations.push(
      `Layout: display=${computedStyles.display}, align=${computedStyles.alignItems}, justify=${computedStyles.justifyContent}.`
    )
  }

  if (augmentations.length > 0) {
    return `${rawIntent}\n\n[Enrichment: ${augmentations.join(' ')}]`
  }
  return rawIntent
}

export function buildEnrichedContext(
  el: HTMLElement,
  intentText: string,
  options: {
    quickAction?: string
    constraints: EnrichedContext['constraints']
    includeScreenshots: boolean
  }
): EnrichedContext {
  const identity = resolveComponent(el)
  const computedStyles = extractDesignStyles(el)
  const className = el.className || ''

  const augmented = augmentIntent(intentText, computedStyles, className)

  return {
    intent: {
      rawText: intentText,
      quickAction: options.quickAction,
      augmentedIntent: augmented !== intentText ? augmented : undefined,
    },
    target: {
      componentName: identity.componentName,
      filePath: identity.filePath,
      lineNumber: identity.lineNumber,
      isSharedComponent: false,
      usageCount: 0,
      usageLocations: [],
      fiberResolutionMethod: identity.method,
      tagName: el.tagName.toLowerCase(),
      textContent: el.textContent?.slice(0, 100)?.trim() || '',
      ...(identity.classNameHint ? { classNameHint: identity.classNameHint } : {}),
      ...(identity.textContentHint ? { textContentHint: identity.textContentHint } : {}),
    } as any,
    currentState: {
      className,
      computedStyles,
      inheritedStyles: extractInheritedStyles(el),
    },
    designContext: crossReferenceTokens(computedStyles, className),
    structuralContext: buildStructuralContext(el),
    constraints: options.constraints,
    // Page context
    page: {
      url: location.pathname,
      title: document.title,
    },
  }
}

/**
 * Cross-references current element styles against known design tokens.
 * Identifies relevant tokens and convention violations.
 */
function crossReferenceTokens(
  computedStyles: ComputedDesignStyles,
  className: string
): EnrichedContext['designContext'] {
  const relevantTokens: Array<{ name: string; value: string }> = []
  const conventionViolations: string[] = []

  if (cachedTokens.length === 0) {
    return { relevantTokens, conventionViolations }
  }

  // Check color tokens
  const colorTokens = cachedTokens.filter(t => t.category === 'color')
  const elementColor = computedStyles.color
  const elementBg = computedStyles.backgroundColor

  for (const token of colorTokens) {
    // Check if this token's color matches the element's color or bg
    if (colorMatchesToken(elementColor, token.value) || colorMatchesToken(elementBg, token.value)) {
      relevantTokens.push({ name: token.name, value: token.value })
    }
  }

  // Check for raw Tailwind color classes when semantic tokens are available
  const semanticColorTokens = cachedTokens.filter(t =>
    t.category === 'color' && (
      t.name.includes('foreground') ||
      t.name.includes('background') ||
      t.name.includes('muted') ||
      t.name.includes('primary') ||
      t.name.includes('secondary') ||
      t.name.includes('accent')
    )
  )

  if (semanticColorTokens.length > 0) {
    // Check if className uses raw color classes like text-gray-500 instead of semantic tokens
    const rawColorPattern = /text-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/
    const match = className.match(rawColorPattern)
    if (match) {
      conventionViolations.push(
        `Uses \`${match[0]}\` but project has semantic color tokens. Consider using a semantic token like text-muted-foreground or text-foreground.`
      )
    }

    const rawBgPattern = /bg-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/
    const bgMatch = className.match(rawBgPattern)
    if (bgMatch) {
      conventionViolations.push(
        `Uses \`${bgMatch[0]}\` but project has semantic color tokens. Consider using a semantic token like bg-background or bg-muted.`
      )
    }
  }

  // Check spacing tokens
  const spacingTokens = cachedTokens.filter(t => t.category === 'spacing')
  if (spacingTokens.length > 0) {
    for (const token of spacingTokens) {
      if (computedStyles.padding.includes(token.value) || computedStyles.gap === token.value) {
        relevantTokens.push({ name: token.name, value: token.value })
      }
    }
  }

  return { relevantTokens, conventionViolations }
}

function colorMatchesToken(computedColor: string, tokenValue: string): boolean {
  // Convert hex token to rgb for comparison
  if (!tokenValue.startsWith('#')) return false

  const hex = tokenValue.replace('#', '')
  if (hex.length !== 6) return false

  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)

  // Check if computed color (rgb/rgba format) matches
  const rgbMatch = computedColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!rgbMatch) return false

  return (
    Math.abs(parseInt(rgbMatch[1]) - r) < 5 &&
    Math.abs(parseInt(rgbMatch[2]) - g) < 5 &&
    Math.abs(parseInt(rgbMatch[3]) - b) < 5
  )
}

// Color utilities for contrast checking
interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

function parseRgba(color: string): RGBA | null {
  const rgbaMatch = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  )
  if (!rgbaMatch) return null
  return {
    r: parseInt(rgbaMatch[1]),
    g: parseInt(rgbaMatch[2]),
    b: parseInt(rgbaMatch[3]),
    a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
  }
}

function relativeLuminance(rgba: RGBA): number {
  const [rs, gs, bs] = [rgba.r / 255, rgba.g / 255, rgba.b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  )
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function getContrastRatio(fg: RGBA, bg: RGBA): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}
