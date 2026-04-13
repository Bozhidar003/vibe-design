import type { ComponentIdentity } from './types.js'

/**
 * Tier 1A — React Fiber resolution via _debugSource
 * Available in React dev mode (Next.js dev by default)
 */
// React/Next.js internal component names to skip — these are never what the user wants
const FRAMEWORK_INTERNALS = new Set([
  'SegmentViewNode', 'InnerLayoutRouter', 'OuterLayoutRouter', 'RenderFromTemplateContext',
  'ScrollAndFocusHandler', 'RedirectErrorBoundary', 'NotFoundErrorBoundary',
  'LoadingBoundary', 'ErrorBoundary', 'InnerScrollAndFocusHandler',
  'ClientPageRoot', 'ClientSegmentRoot', 'LayoutSegment',
  'Suspense', 'Fragment', 'StrictMode', 'Profiler', 'Provider', 'Consumer',
  'ForwardRef', 'Memo', 'Lazy', 'Portal',
  'ServerRoot', 'AppRouter', 'HotReload', 'ReactDevOverlay',
  'PathnameContextProviderAdapter', 'MetadataBoundary', 'ViewportBoundary',
  'OuterLayoutRouter', 'RootLayout',
])

function isUserComponent(name: string | null | undefined): boolean {
  if (!name || typeof name !== 'string') return false
  if (!/^[A-Z]/.test(name)) return false
  if (FRAMEWORK_INTERNALS.has(name)) return false
  // Skip generic single-word internals that start with __
  if (name.startsWith('__')) return false
  return true
}

export function resolveViaFiber(el: HTMLElement): ComponentIdentity | null {
  const fiberKey = Object.keys(el).find(
    (k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
  )
  if (!fiberKey) return null

  // First pass: find the nearest USER component with _debugSource
  let fiber = (el as any)[fiberKey]
  let bestWithSource: ComponentIdentity | null = null
  let bestWithoutSource: ComponentIdentity | null = null

  while (fiber) {
    const name = fiber.type?.name || fiber.type?.displayName
    const source = fiber._debugSource

    if (isUserComponent(name) && source) {
      const filePath = normalizeFilePath(source.fileName)
      // Skip node_modules and framework paths
      if (!filePath.includes('node_modules') && !filePath.includes('next/')) {
        bestWithSource = {
          componentName: name,
          filePath,
          lineNumber: source.lineNumber ?? null,
          props: sanitizeProps(fiber.memoizedProps),
          method: 'fiber',
        }
        break // Found a real user component with source — use it
      }
    }

    // Track best name-only match as fallback
    if (isUserComponent(name) && !bestWithoutSource) {
      bestWithoutSource = {
        componentName: name,
        filePath: null,
        lineNumber: null,
        props: sanitizeProps(fiber.memoizedProps),
        method: 'fiber',
      }
    }

    fiber = fiber.return
  }

  return bestWithSource ?? bestWithoutSource
}

function findParentWithSource(fiber: any): boolean {
  let current = fiber
  let depth = 0
  while (current && depth < 5) {
    if (current.type?.name && current._debugSource) return true
    current = current.return
    depth++
  }
  return false
}

/**
 * Tier 1B — Vue component resolution via __vue__ / __vueParentComponent
 * Available in Vue dev mode
 */
export function resolveViaVue(el: HTMLElement): ComponentIdentity | null {
  // Vue 3: __vueParentComponent
  const vue3Instance = (el as any).__vueParentComponent
  if (vue3Instance) {
    const component = vue3Instance
    const name = component.type?.name || component.type?.__name
    const file = component.type?.__file

    if (name) {
      return {
        componentName: name,
        filePath: file ? normalizeFilePath(file) : null,
        lineNumber: null,
        props: sanitizeProps(component.props),
        method: 'fiber', // Using 'fiber' as the method name for consistency
      }
    }
  }

  // Vue 2: __vue__
  const vue2Instance = (el as any).__vue__
  if (vue2Instance) {
    const name = vue2Instance.$options?.name || vue2Instance.$options?._componentTag
    const file = vue2Instance.$options?.__file

    if (name) {
      return {
        componentName: name,
        filePath: file ? normalizeFilePath(file) : null,
        lineNumber: null,
        props: sanitizeProps(vue2Instance.$props),
        method: 'fiber',
      }
    }
  }

  // Walk up to find a Vue component on an ancestor
  let current: HTMLElement | null = el.parentElement
  let depth = 0
  while (current && current !== document.body && depth < 10) {
    const result = resolveVueDirectly(current)
    if (result) return result
    current = current.parentElement
    depth++
  }

  return null
}

function resolveVueDirectly(el: HTMLElement): ComponentIdentity | null {
  const vue3 = (el as any).__vueParentComponent
  if (vue3) {
    const name = vue3.type?.name || vue3.type?.__name
    if (name) {
      return {
        componentName: name,
        filePath: vue3.type?.__file ? normalizeFilePath(vue3.type.__file) : null,
        lineNumber: null,
        props: sanitizeProps(vue3.props),
        method: 'fiber',
      }
    }
  }

  const vue2 = (el as any).__vue__
  if (vue2) {
    const name = vue2.$options?.name || vue2.$options?._componentTag
    if (name) {
      return {
        componentName: name,
        filePath: vue2.$options?.__file ? normalizeFilePath(vue2.$options.__file) : null,
        lineNumber: null,
        props: sanitizeProps(vue2.$props),
        method: 'fiber',
      }
    }
  }

  return null
}

/**
 * Tier 1C — Svelte component resolution via __svelte_meta
 * Available in Svelte dev mode with compilerOptions.dev = true
 */
export function resolveViaSvelte(el: HTMLElement): ComponentIdentity | null {
  // Svelte 4+ attaches component metadata in dev mode
  // The __svelte_meta property contains component info
  let current: HTMLElement | null = el
  let depth = 0

  while (current && current !== document.body && depth < 10) {
    // Svelte 5 uses $$ internals
    const svelteContext = (current as any).__svelte_meta ||
      (current as any)?.__svelte_component_metadata

    if (svelteContext) {
      const loc = svelteContext.loc
      if (loc) {
        // Extract component name from file path
        const filePath = loc.file || ''
        const name = extractComponentNameFromPath(filePath)
        return {
          componentName: name,
          filePath: filePath ? normalizeFilePath(filePath) : null,
          lineNumber: loc.line ?? null,
          props: null,
          method: 'fiber',
        }
      }
    }

    // Svelte 4: check for ctx on the element
    const svelteComponent = (current as any).__svelte
    if (svelteComponent) {
      const ctor = svelteComponent.constructor
      const name = ctor?.name
      if (name && name !== 'SvelteComponent') {
        return {
          componentName: name,
          filePath: null,
          lineNumber: null,
          props: null,
          method: 'fiber',
        }
      }
    }

    // Check for data-svelte-h attribute (Svelte hydration markers)
    const svelteH = current.getAttribute('data-svelte-h')
    if (svelteH) {
      // This at least tells us it's a Svelte component
      // The actual component name needs server-side resolution
    }

    current = current.parentElement
    depth++
  }

  return null
}

function extractComponentNameFromPath(filePath: string): string {
  // Extract "Button" from "src/components/Button.svelte"
  const match = filePath.match(/([^/\\]+)\.\w+$/)
  if (match) {
    return match[1]
  }
  return 'SvelteComponent'
}

/**
 * Tier 2 — DOM Attribute Heuristics
 */
export function resolveViaDOMHeuristics(el: HTMLElement): ComponentIdentity | null {
  let current: HTMLElement | null = el
  while (current && current !== document.body) {
    const testId = current.getAttribute('data-testid')
    const componentAttr = current.getAttribute('data-component')
    const id = current.id

    // Also check for framework-specific attributes
    const svelteComponent = current.getAttribute('data-sveltekit:component')
    const nuxtComponent = current.getAttribute('data-v-')

    const identifier = testId || componentAttr || svelteComponent || id
    if (identifier && looksLikeComponentName(identifier)) {
      return {
        componentName: pascalCase(identifier),
        filePath: null,
        lineNumber: null,
        props: null,
        method: 'dom-heuristic',
        classNameHint: current.className,
      }
    }

    // Check for Vue scoped style attributes (data-v-XXXX)
    if (nuxtComponent || hasVueScopedAttr(current)) {
      const vueName = findVueComponentName(current)
      if (vueName) {
        return {
          componentName: vueName,
          filePath: null,
          lineNumber: null,
          props: null,
          method: 'dom-heuristic',
          classNameHint: current.className,
        }
      }
    }

    current = current.parentElement
  }
  return null
}

function hasVueScopedAttr(el: HTMLElement): boolean {
  return Array.from(el.attributes).some(a => a.name.startsWith('data-v-'))
}

function findVueComponentName(el: HTMLElement): string | null {
  // Try to find a component name from the element's class or attributes
  const classes = el.className.split(' ')
  for (const cls of classes) {
    if (/^[A-Z]/.test(cls) && cls.length > 2) {
      return cls
    }
  }
  return null
}

/**
 * Tier 3 — Class-based file search (always available)
 */
export function resolveViaClassSearch(el: HTMLElement): ComponentIdentity {
  return {
    componentName: null,
    filePath: null,
    lineNumber: null,
    props: null,
    method: 'unresolved',
    classNameHint: el.className,
    tagName: el.tagName.toLowerCase(),
    textContentHint: el.textContent?.slice(0, 100) ?? undefined,
  }
}

/**
 * Tiered resolution: tries React Fiber → Vue → Svelte → DOM heuristics → class search
 */
export function resolveComponent(el: HTMLElement): ComponentIdentity {
  return (
    resolveViaFiber(el) ??
    resolveViaVue(el) ??
    resolveViaSvelte(el) ??
    resolveViaDOMHeuristics(el) ??
    resolveViaClassSearch(el)
  )
}

function looksLikeComponentName(str: string): boolean {
  const blacklist = ['root', 'app', '__next', 'main', 'content', 'wrapper', 'container', 'layout', '__nuxt', '__sveltekit']
  return (
    str.length > 2 &&
    !blacklist.includes(str.toLowerCase()) &&
    /^[A-Za-z]/.test(str)
  )
}

function pascalCase(str: string): string {
  return str
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, '')
}

function normalizeFilePath(filePath: string): string {
  let normalized = filePath
    .replace(/^webpack:\/\/\//, '')
    .replace(/^file:\/\//, '')
    .replace(/^\.\//g, '')
    .replace(/\?.*$/, '') // strip query params

  // Convert absolute paths to project-relative
  const srcIndex = normalized.indexOf('src/')
  if (srcIndex !== -1) {
    normalized = normalized.slice(srcIndex)
  }

  return normalized
}

function sanitizeProps(props: any): Record<string, unknown> | null {
  if (!props || typeof props !== 'object') return null

  const safe: Record<string, unknown> = {}
  const allowedTypes = ['string', 'number', 'boolean']

  for (const [key, value] of Object.entries(props)) {
    if (key === 'children') continue
    if (key.startsWith('__')) continue
    if (allowedTypes.includes(typeof value)) {
      safe[key] = value
    }
  }

  return Object.keys(safe).length > 0 ? safe : null
}
