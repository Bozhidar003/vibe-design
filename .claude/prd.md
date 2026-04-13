# Vibe Design — Product Requirements Document

---

## 1. Executive Summary

Vibe Design is a developer-first visual design tool that sits on top of Claude Code. It injects an intelligent overlay into any running web dev server, lets the developer click any UI element, and sends a fully-contextualized, enriched design prompt — with component source, computed styles, design tokens, structural context, and project conventions — directly to Claude Code for execution.

The result: a tight visual → intent → enriched context → code loop that replaces the current workflow of mentally translating visual problems into text prompts.

**Tagline:** *Click what's broken. Describe what you want. Claude fixes it.*

**Core Thesis:** Claude Code's design output quality is bottlenecked by context quality. The enrichment engine — not the overlay UI — is the product. Everything else is plumbing.

---

## 2. The Problem

### 2.1 Current Vibe Coding Design Workflow

```
See visual problem
  → mentally translate to text
    → type prompt with no visual context
      → Claude guesses what you mean
        → wait for change
          → refresh browser
            → wrong, try again
```

Every step is lossy. The developer sees the problem but Claude Code works blind. The mental translation from "this button looks cheap" to a textual prompt that conveys enough context — component name, current classes, visual hierarchy, surrounding elements — is slow, error-prone, and requires expertise.

### 2.2 Root Causes

- **No visual grounding** — Claude Code has no idea what the rendered UI looks like
- **No component context** — prompts say "fix the button" not "fix `Button.tsx:47` which has `bg-blue-600 rounded-md px-4 py-2`"
- **No computed state** — Claude doesn't know the actual rendered font-size, effective color, or layout model in use
- **No project conventions** — Claude Code doesn't know you use shadcn, CVA variants, or that your primary color is `#2563eb`
- **No usage awareness** — changing `Button.tsx` affects 12 other pages; Claude doesn't know that without being told
- **No structural context** — Claude doesn't know what's around the element: parent layout, sibling elements, visual hierarchy

### 2.3 What Developers Actually Want

> "I want to point at a thing on the screen, say what I want, and have it just work — knowing all the context about my project already."

---

## 3. Solution Overview

Vibe Design is four things working together:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  1. OVERLAY        2. ENRICHMENT     3. SKILL         4. BRIDGE    │
│  Injected script   ENGINE            SYSTEM           Local server │
│  in dev server     Transforms        .vibe/ folder    connecting   │
│  DOM. Visual       click + intent    with project-    overlay to   │
│  picker + prompt   into full-        aware Claude     Claude Code. │
│  panel.            context prompt.   Code skills.                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### The Full Loop

```
npx vibe-design init
  → detects stack (Next.js + Tailwind + shadcn)
  → generates .vibe/skills/ with project-aware context
  → writes .claude/skills/vibe-design/

npx vibe-design start
  → starts local vibe server (port 2337)
  → injects overlay.js into localhost:3000

Developer activates Design Mode (⌘D)
  → hovers element → blue outline + component label
  → clicks element → prompt panel opens
  → sees: component name, file path, current classes
  → types "make these links more visible"
  → optionally toggles "Include screenshot" for visual problems
  → hits ⌘↵

Enrichment Engine assembles:
  1. Developer's intent (raw text + quick action modifiers)
  2. Component identity (name, file, line, shared vs inline)
  3. Current state (className + 20 key computed style properties)
  4. Design system context (matching tokens, convention violations)
  5. Structural context (parent layout, siblings, container)
  6. Constraints (Tailwind only, keep accessible, etc.)
  7. Usage impact (which pages render this component)
  8. [Optional] Screenshots (element crop + viewport with bounding box)

Local vibe server receives enriched payload
  → writes .vibe/tasks/DESIGN_TASK.md
  → optionally saves screenshots
  → triggers Claude Code

Claude Code reads:
  → DESIGN_TASK.md (the enriched task)
  → .vibe/skills/TAILWIND.md (your design tokens)
  → .vibe/skills/COMPONENTS.md (your shadcn conventions)
  → makes the change
  → Next.js hot reloads
  → developer sees result immediately
```

---

## 4. Technical Architecture

### 4.1 System Components

```
vibe-design/
├── packages/
│   ├── cli/              ← npx vibe-design (init, start, sync, detect, eject)
│   ├── overlay/          ← injected browser script (Shadow DOM isolated)
│   ├── enricher/         ← THE CORE: transforms click+intent into enriched context
│   ├── server/           ← local vibe server (port 2337)
│   ├── detector/         ← stack detection logic
│   ├── skill-generator/  ← generates .vibe/skills/ from detection
│   └── adapters/
│       ├── nextjs/       ← next.config.js plugin
│       ├── vite/         ← vite plugin (Phase 4)
│       └── proxy/        ← framework-agnostic HTTP proxy (Phase 4)
```

---

### 4.2 CLI (`npx vibe-design`)

**Commands:**

| Command | Description |
|---------|-------------|
| `init` | Detect stack, generate `.vibe/`, inject adapter, write Claude Code skills |
| `start` | Start local vibe server + overlay injection |
| `sync` | Re-run detection, regenerate skills (after adding new dependencies) |
| `detect` | Print detected stack without making changes |
| `task` | Manually trigger a design task from CLI |
| `eject` | Remove overlay + adapter, keep `.vibe/skills/` as standalone Claude Code context |

**`init` flow:**

```
1. Read package.json, tsconfig.json, tailwind.config.*
2. Scan src/ for component patterns using AST parsing
3. Detect framework, CSS approach, component library
4. Generate .vibe/config.json (see schema below)
5. Generate .vibe/skills/*.md with real project values
6. Write .claude/skills/vibe-design/ (Claude Code integration)
7. Inject adapter (next.config.js wrapper)
8. Print summary + next steps
```

**`eject` flow:**

```
1. Remove next.config.js withVibeDesign wrapper
2. Remove overlay injection
3. Remove .vibe/tasks/ and .vibe/screenshots/
4. KEEP .vibe/skills/ — these are useful standalone Claude Code context
5. KEEP .claude/skills/vibe-design/ — still works with manual DESIGN_TASK.md
6. Print: "Ejected. Skills preserved for Claude Code use."
```

**`.vibe/config.json` schema:**

```json
{
  "port": 2337,
  "autoTrigger": false,
  "screenshotDefault": false,
  "screenshotScale": 2,
  "claudeCommand": "claude",
  "excludeComponents": [],
  "customSkills": [],
  "overlay": {
    "activationKey": "d",
    "position": "bottom-right"
  },
  "detection": {
    "srcDir": "src/",
    "componentsDir": "src/components/",
    "appDir": "src/app/"
  }
}
```

---

### 4.3 Stack Detector

Runs heuristics against the project filesystem and `package.json`. Uses AST parsing (via `@swc/core` or TypeScript compiler API) for accurate component scanning.

```typescript
interface DetectedStack {
  // Framework
  framework: 'nextjs' | 'vite-react' | 'remix' | 'sveltekit' | 'unknown'
  frameworkVersion: string
  router: 'app' | 'pages' | 'file-based' | null

  // CSS
  css: 'tailwind' | 'cssmodules' | 'styled-components' | 'emotion' | 'vanilla'
  tailwindVersion?: string
  tailwindConfig?: ParsedTailwindConfig

  // Component library
  components: 'shadcn' | 'radix' | 'mantine' | 'chakra' | 'mui' | 'custom'

  // Language
  typescript: boolean

  // Project structure
  srcDir: string
  appDir: string
  componentsDir: string

  // Design system (extracted values, not templates)
  designTokens: DesignToken[]
  componentPatterns: ComponentPattern[]
}
```

**Detection rules:**

```typescript
const detectors = {
  nextjs: (pkg) => !!pkg.dependencies?.next,
  tailwind: (pkg, fs) =>
    !!pkg.devDependencies?.tailwindcss ||
    !!pkg.dependencies?.tailwindcss ||
    fs.exists('tailwind.config.ts') ||
    fs.exists('tailwind.config.js'),
  shadcn: (pkg, fs) =>
    fs.exists('components.json') || // shadcn config file
    fs.exists('components/ui/button.tsx') ||
    fs.exists('src/components/ui/button.tsx'),
  typescript: (pkg, fs) => fs.exists('tsconfig.json'),
}
```

**Tailwind token extraction (specific logic):**

```typescript
// 1. Parse tailwind.config.ts using JS eval or SWC (not regex)
// 2. Extract theme.extend.colors — flatten nested keys:
//    { brand: { primary: '#2563eb' } } → 'brand-primary': '#2563eb'
// 3. Map each custom color to nearest default Tailwind color for reference:
//    'brand-primary': '#2563eb' → "brand-primary: #2563eb (≈ blue-600)"
// 4. Extract theme.extend.spacing, fontSize, borderRadius, boxShadow
// 5. Extract any CSS custom properties from globals.css / app.css
```

**Component scanning (specific logic):**

```typescript
// 1. Use TypeScript compiler API to find files exporting React components
// 2. For each component:
//    a. Extract exported name
//    b. Extract props interface/type (if TypeScript)
//    c. Detect styling pattern: CVA, cn(), raw className, styled-components
//    d. Count import references across project (usage count)
//    e. Detect if it's a shared/library component vs page-specific
// 3. Output: sorted list with name, path, usage count, styling pattern
```

---

### 4.4 The Enrichment Engine (`packages/enricher/`)

**This is the core of the product.** The enrichment engine transforms a developer's click + intent into a fully-contextualized prompt that gives Claude Code everything it needs to make the right change on the first try.

#### 4.4.1 Enrichment Pipeline

The engine runs in the browser (overlay-side) and assembles an `EnrichedContext` object:

```typescript
interface EnrichedContext {
  // Layer 1: Developer Intent (what they want — always first in output)
  intent: {
    rawText: string                    // "make these links more visible"
    quickAction?: string               // e.g. "spacing", "color", "typography"
    augmentedIntent?: string           // system-generated design translation
  }

  // Layer 2: Element Identity (which thing)
  target: {
    componentName: string | null       // "NavLink"
    filePath: string | null            // "src/components/NavLink.tsx"
    lineNumber: number | null          // 47
    isSharedComponent: boolean         // true = used in multiple files
    usageCount: number                 // 4 files import this
    usageLocations: string[]           // ["/", "/about", "/products", "/blog"]
    rawJSX?: string                    // the JSX snippet for this element
    fiberResolutionMethod: 'fiber' | 'dom-heuristic' | 'unresolved'
  }

  // Layer 3: Current Styling State (what it looks like now)
  currentState: {
    className: string                  // "text-gray-400 text-sm hover:text-gray-600"
    computedStyles: ComputedDesignStyles  // 20 key properties (see below)
    inheritedStyles: {                 // styles inherited from parent
      fontSize?: string
      color?: string
      fontFamily?: string
      lineHeight?: string
    }
  }

  // Layer 4: Design System Context (what conventions exist)
  designContext: {
    relevantTokens: DesignToken[]      // tokens that relate to current element
    conventionViolations: string[]     // "uses text-gray-400 but project convention is text-muted"
    availableVariants?: string[]       // if component uses CVA: ["default", "outline", "ghost"]
  }

  // Layer 5: Structural Context (what's around it)
  structuralContext: {
    parentComponent: {
      name: string | null
      className: string
      computedLayout: {                // parent's layout properties only
        display: string
        flexDirection?: string
        alignItems?: string
        justifyContent?: string
        gap?: string
        gridTemplateColumns?: string
      }
    }
    siblings: Array<{
      componentName: string | null
      className: string
      tagName: string
    }>
    containerInfo: string              // "Inside a flex-row with 3 siblings, gap-4"
  }

  // Layer 6: Constraints
  constraints: {
    tailwindOnly: boolean              // default true
    keepAccessible: boolean            // default true
    allowNewDependencies: boolean      // default false
    allowNewFiles: boolean             // default false
  }

  // Layer 7: Optional Visual Context
  screenshots?: {
    elementCrop: string                // base64 PNG of cropped element
    viewportWithBoundingBox: string    // base64 PNG of full viewport with red rect around element
  }
}
```

#### 4.4.2 Computed Design Styles

Only the 20 properties that matter for design work — not a raw `getComputedStyle()` dump:

```typescript
interface ComputedDesignStyles {
  // Typography
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
  color: string
  textAlign: string

  // Spacing
  padding: string           // shorthand: "16px 24px"
  margin: string
  gap: string

  // Layout
  display: string
  flexDirection: string
  alignItems: string
  justifyContent: string

  // Visual
  backgroundColor: string
  borderRadius: string
  border: string
  boxShadow: string
  opacity: string

  // Size
  width: string
  height: string
}
```

Extraction function:

```javascript
function extractDesignStyles(el) {
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
```

#### 4.4.3 Intent Augmentation

The enrichment engine can augment the developer's raw intent with inferred design context. This does NOT change what the developer asked for — it translates their visual observation into design language that helps Claude Code:

```javascript
function augmentIntent(rawIntent, currentState, designContext) {
  const augmentations = []

  // Detect low contrast
  const color = parseColor(currentState.computedStyles.color)
  const bg = parseColor(currentState.computedStyles.backgroundColor)
  const contrast = getContrastRatio(color, bg)
  if (contrast < 4.5 && rawIntent.match(/visible|readable|see|contrast/i)) {
    augmentations.push(
      `Current contrast ratio is ${contrast.toFixed(1)}:1 (WCAG AA requires 4.5:1).`
    )
  }

  // Detect small text
  const fontSize = parseFloat(currentState.computedStyles.fontSize)
  if (fontSize < 14 && rawIntent.match(/small|bigger|larger|visible|readable/i)) {
    augmentations.push(
      `Current font size is ${fontSize}px (${currentState.className} resolves to this).`
    )
  }

  // Detect spacing issues
  if (rawIntent.match(/spacing|cramped|tight|breathe|room/i)) {
    augmentations.push(
      `Current padding: ${currentState.computedStyles.padding}. Parent gap: ${currentState.computedStyles.gap || 'none'}.`
    )
  }

  return augmentations.length > 0
    ? `${rawIntent}\n\n[Enrichment context: ${augmentations.join(' ')}]`
    : rawIntent
}
```

#### 4.4.4 Component Identity Resolution (Tiered Fallback)

The overlay tries three strategies in order, uses the first that succeeds:

**Tier 1 — React Fiber (`_debugSource`):**

```javascript
function resolveViaFiber(el) {
  const fiberKey = Object.keys(el).find(k =>
    k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
  )
  if (!fiberKey) return null

  let fiber = el[fiberKey]
  while (fiber) {
    const name = fiber.type?.name || fiber.type?.displayName
    const source = fiber._debugSource

    if (name && source) {
      return {
        componentName: name,
        filePath: source.fileName,
        lineNumber: source.lineNumber,
        props: sanitizeProps(fiber.memoizedProps),
        method: 'fiber'
      }
    }
    fiber = fiber.return
  }
  return null
}
```

> **Note:** `_debugSource` is available in Next.js dev mode by default. No config needed. Fails silently for RSC (server components that never hydrate) and some bundler configurations.

**Tier 2 — DOM Attribute Heuristics:**

```javascript
function resolveViaDOMHeuristics(el) {
  // Walk up looking for identifying attributes
  let current = el
  while (current && current !== document.body) {
    // Check common component markers
    const testId = current.getAttribute('data-testid')
    const componentAttr = current.getAttribute('data-component')
    const id = current.id

    const identifier = testId || componentAttr || id
    if (identifier && looksLikeComponentName(identifier)) {
      return {
        componentName: pascalCase(identifier),
        filePath: null,   // will be resolved server-side by grep
        lineNumber: null,
        props: null,
        method: 'dom-heuristic',
        // Send className so server can grep for the file
        classNameHint: current.className
      }
    }
    current = current.parentElement
  }
  return null
}

function looksLikeComponentName(str) {
  // Filters out generic IDs like "root", "app", "__next"
  return str.length > 2 &&
    !['root', 'app', '__next', 'main', 'content'].includes(str) &&
    /^[A-Za-z]/.test(str)
}
```

**Tier 3 — Class-based File Search (always available):**

```javascript
function resolveViaClassSearch(el) {
  // Collect the full className
  // Server-side: grep src/ for files containing this exact class combination
  return {
    componentName: null,
    filePath: null,          // resolved server-side
    lineNumber: null,
    props: null,
    method: 'unresolved',
    classNameHint: el.className,
    tagName: el.tagName.toLowerCase(),
    // Include nearby text content for server-side search
    textContentHint: el.textContent?.slice(0, 100)
  }
}
```

**Server-side resolution for Tier 2 & 3:**

```typescript
// When overlay sends a classNameHint without filePath,
// the vibe server resolves it:
async function resolveFileFromHints(hints: {
  componentName?: string,
  classNameHint?: string,
  textContentHint?: string
}): Promise<{ filePath: string, lineNumber: number } | null> {

  const { componentName, classNameHint } = hints
  const srcDir = config.detection.srcDir

  // Try component name first
  if (componentName) {
    const files = await glob(`${srcDir}/**/${componentName}.{tsx,jsx,ts,js}`)
    if (files.length === 1) return { filePath: files[0], lineNumber: 1 }
  }

  // Fall back to className grep
  if (classNameHint) {
    // Extract most specific classes (skip common ones like "flex", "p-4")
    const specificClasses = classNameHint.split(' ')
      .filter(c => c.length > 5 && !COMMON_CLASSES.has(c))
      .slice(0, 3)

    if (specificClasses.length > 0) {
      const grepPattern = specificClasses.join('.*')
      const result = await exec(
        `grep -rn "${grepPattern}" ${srcDir} --include="*.tsx" --include="*.jsx" -l`
      )
      const files = result.stdout.trim().split('\n').filter(Boolean)
      if (files.length === 1) return { filePath: files[0], lineNumber: 1 }
      if (files.length > 1) return { filePath: files[0], lineNumber: 1 }  // best guess
    }
  }

  return null
}
```

---

### 4.5 Overlay Script

The injected browser script. Runs entirely in the browser. **All overlay UI lives inside a Shadow DOM root to prevent CSS collisions with the host page.**

#### 4.5.1 Shadow DOM Isolation

```javascript
// All overlay UI is injected into a Shadow DOM container
function initOverlay() {
  const host = document.createElement('div')
  host.id = 'vibe-design-host'
  host.style.cssText = 'position:fixed; z-index:2147483647; top:0; left:0; pointer-events:none;'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'closed' })

  // Inject overlay styles into shadow root (not the page)
  const style = document.createElement('style')
  style.textContent = OVERLAY_STYLES  // all overlay CSS lives here
  shadow.appendChild(style)

  const container = document.createElement('div')
  container.id = 'vibe-overlay-root'
  shadow.appendChild(container)

  return { shadow, container }
}
```

This guarantees:
- Host page CSS never affects overlay UI
- Overlay CSS never leaks into host page
- Z-index conflicts are impossible

#### 4.5.2 Activation

- Hotkey `⌘D` (Mac) / `Ctrl+D` (Windows) toggles Design Mode
- Or floating "🎨" button in corner (rendered inside Shadow DOM)

#### 4.5.3 Element Picker

```javascript
document.addEventListener('mouseover', onHover, { capture: true })
document.addEventListener('click', onSelect, { capture: true })

function onHover(e) {
  e.stopPropagation()
  clearHighlights()
  highlightElement(e.target)  // blue outline drawn via overlay in Shadow DOM
  showComponentLabel(e.target) // "NavLink — src/components/NavLink.tsx:12"
}

function onSelect(e) {
  e.preventDefault()
  e.stopPropagation()
  selectedEl = e.target
  const enrichedContext = buildEnrichedContext(e.target)
  openPromptPanel(enrichedContext)
}
```

#### 4.5.4 Multi-Select (Shift+Click)

```javascript
const selection = new Set()

function onSelect(e) {
  if (e.shiftKey) {
    selection.add(e.target)
    updateSelectionOverlay()
  } else {
    selection.clear()
    selection.add(e.target)
    openPromptPanel()
  }
}
```

Use case: select 3 cards → "make these consistent with each other"
Multi-select assembles an `EnrichedContext` for each element.

#### 4.5.5 Screenshot Capture (Optional)

Screenshots are **off by default** and toggled on via the prompt panel. When enabled, two captures are produced:

```javascript
async function captureScreenshots(el) {
  const rect = el.getBoundingClientRect()
  const padding = 24

  // 1. Element crop
  const elementCrop = await html2canvas(document.body, {
    x: Math.max(0, rect.x - padding),
    y: Math.max(0, rect.y - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    scale: window.devicePixelRatio,
    useCORS: true,
    logging: false,
    ignoreElements: (el) => el.id === 'vibe-design-host' // ignore overlay
  })

  // 2. Full viewport with bounding box overlay
  const viewportCapture = await html2canvas(document.body, {
    scale: 1,  // lower res is fine for context
    useCORS: true,
    logging: false,
    ignoreElements: (el) => el.id === 'vibe-design-host'
  })
  // Draw red bounding box on viewport capture
  const ctx = viewportCapture.getContext('2d')
  ctx.strokeStyle = '#ef4444'
  ctx.lineWidth = 3
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)

  return {
    elementCrop: elementCrop.toDataURL('image/png'),
    viewportWithBoundingBox: viewportCapture.toDataURL('image/png')
  }
}
```

#### 4.5.6 Prompt Panel UI

Rendered inside Shadow DOM:

```
┌──────────────────────────────────────────────────────────┐
│ 🎯 NavLink  ·  src/components/NavLink.tsx:12  (4 usages)│
│                                                          │
│ Classes: text-gray-400 text-sm hover:text-gray-600       │
│ Computed: 14px · 400 weight · rgba(156,163,175,1)        │
│ Parent: <nav> flex flex-row gap-6 items-center           │
│                                                          │
│ Quick: [Typography] [Color] [Spacing]                    │
│        [Animation] [Responsive] [Dark mode]              │
│        [Extract variant] [Accessibility]                 │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ make these links more visible                        │ │
│ │                                                      │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ☑ Tailwind only  ☑ Keep accessible  □ Allow new files    │
│ □ Include screenshots (for visual/layout issues)         │
│                                                          │
│ ▸ Preview enriched prompt (click to expand)              │
│                                                          │
│                    [Send to Claude Code  ⌘↵]             │
└──────────────────────────────────────────────────────────┘
```

**"Preview enriched prompt"** expands to show the exact DESIGN_TASK.md that will be generated. This lets the developer verify the fiber extraction grabbed the right component and that the enrichment is accurate before sending.

**Quick Action Buttons** expand into pre-built prompt templates:
- **Typography** → "Audit and fix typography. Reference design tokens from tailwind.config"
- **Color** → "Improve color usage for better visual hierarchy. Reference design tokens."
- **Spacing** → "Audit and fix spacing inconsistencies using the project's spacing scale"
- **Extract variant** → "Refactor repeated class combinations into a CVA variant definition"
- **Responsive** → "Add responsive variants for sm/md/lg breakpoints"
- **Dark mode** → "Add dark: variant classes maintaining contrast ratios"
- **Animation** → "Add tasteful transition/animation. Use existing motion conventions if any."
- **Accessibility** → "Audit for WCAG AA compliance. Fix contrast, focus states, aria labels."

---

### 4.6 Skill Generator

Generates `.vibe/skills/*.md` from the detected stack. These are **generated with real values from your project**, not static templates.

**Example: Generated `TAILWIND.md` for a real project**

```markdown
# Tailwind Design System
<!-- Auto-generated by vibe-design sync — do not edit manually -->

Config: `tailwind.config.ts` · Version: 3.4.1

## Custom Colors
- `brand-primary`: #2563eb  (≈ blue-600)
- `brand-secondary`: #7c3aed  (≈ violet-600)
- `surface`: #f8fafc
- `surface-elevated`: #ffffff

## Typography in use (scanned from src/)
- Display: font-bold text-4xl tracking-tight (used in: Hero.tsx, PageHeader.tsx)
- Heading: font-semibold text-2xl (used in: Card.tsx, Section.tsx)
- Body: text-base text-gray-600 leading-relaxed
- Label: text-sm font-medium uppercase tracking-wide text-gray-500

## Spacing Patterns (most common in codebase)
- Cards: p-6, gap-4
- Sections: py-16 px-4 (mobile), md:py-24 md:px-8
- Buttons: px-4 py-2 (sm), px-6 py-3 (md), px-8 py-4 (lg)
- Stack: space-y-4 (tight), space-y-8 (loose)

## Rules
- Never use arbitrary values like w-[437px] — use nearest scale value
- Border radius: rounded-md default, rounded-lg for cards, rounded-full for pills
- Shadows: shadow-sm (subtle), shadow-md (card), shadow-lg (modal/overlay)
```

**Example: Generated `COMPONENTS.md` for shadcn project**

```markdown
# Component Conventions
<!-- Auto-generated by vibe-design sync -->

## Library: shadcn/ui
Components live in: `src/components/ui/`
Variant pattern: class-variance-authority (CVA)
Utility: `cn()` from `src/lib/utils.ts`

## Rules
1. Check existing CVA variants before adding one-off classNames
2. Use cn() for conditional class logic — never string concatenation
3. shadcn components accept a className prop — use it for page-level overrides
4. New variants go in the cva() definition, not inline on usage sites

## Existing Button Variants
variant: default | destructive | outline | secondary | ghost | link
size: default | sm | lg | icon

## Component Index (auto-scanned)
| Component | Path | Usages | Pattern |
|-----------|------|--------|---------|
| Button | src/components/ui/button.tsx | 14 | CVA |
| Card | src/components/ui/card.tsx | 8 | CVA |
| Badge | src/components/ui/badge.tsx | 6 | CVA |
| NavLink | src/components/NavLink.tsx | 4 | cn() |
[...]
```

**Example: Generated `CONVENTIONS.md`**

```markdown
# Project Conventions
<!-- Auto-generated by vibe-design sync -->

## File Organization
- UI primitives: src/components/ui/ (shadcn)
- Feature components: src/components/
- Page-level: src/app/**/page.tsx

## Styling Pattern
- Primary: Tailwind utility classes
- Composition: cn() from src/lib/utils.ts
- Variants: class-variance-authority (CVA)
- Never: inline styles, CSS modules, styled-components

## Detected Patterns
- className always uses cn() when conditional
- Colors reference semantic tokens (text-muted-foreground, not text-gray-500)
- Responsive: mobile-first (base → sm → md → lg)
- Dark mode: dark: prefix, not class-based toggle
```

---

### 4.7 DESIGN_TASK.md Format

The structured handoff between the enrichment engine and Claude Code. **Intent comes first** because it frames how Claude Code interprets everything that follows.

```markdown
# Design Task
Generated: 2025-01-15 14:30:22
Status: pending

## Design Intent
"make these links more visible"

[Enrichment context: Current contrast ratio is 3.2:1 (WCAG AA requires 4.5:1). Current font size is 14px (text-sm resolves to this).]

Quick action: none
Constraints:
- [x] Tailwind only (no new CSS files)
- [x] Keep WCAG AA contrast
- [ ] Allow new dependencies
- [ ] Allow new files

## Target Component
**NavLink** · `src/components/NavLink.tsx:12`
Resolution method: fiber
Shared component: yes — used in 4 files
Usage locations: `/`, `/about`, `/products`, `/blog`

## Current Styling State
**Classes:** `text-gray-400 text-sm hover:text-gray-600`

**Computed Styles:**
| Property | Value |
|----------|-------|
| font-family | Inter, sans-serif |
| font-size | 14px |
| font-weight | 400 |
| line-height | 20px |
| color | rgba(156, 163, 175, 1) |
| padding | 0px 0px 0px 0px |

**Inherited from parent:**
| Property | Value |
|----------|-------|
| font-size | 16px |
| color | rgba(17, 24, 39, 1) |

## Structural Context
**Parent:** `<nav>` · `flex flex-row items-center gap-6`
**Siblings:** 4 other NavLink elements, 1 Button (CTA)
**Container:** Inside header, flex row, justify-between

## Design System Context
**Relevant tokens:** text-muted-foreground (#64748b), text-foreground (#0f172a)
**Convention note:** Project uses semantic color tokens. text-gray-400 may be inconsistent with convention — consider text-muted-foreground.

## Visual Context
Not included — text context only.
(or, if screenshots enabled:)
![Element screenshot](.vibe/screenshots/element-crop.png)
![Viewport context](.vibe/screenshots/viewport.png)

## Applicable Skills
Read before making changes:
- .vibe/skills/TAILWIND.md — design tokens and spacing conventions
- .vibe/skills/COMPONENTS.md — component patterns and CVA conventions
- .vibe/skills/CONVENTIONS.md — project-specific rules
```

---

### 4.8 Local Vibe Server

Node.js server on port 2337. Responsibilities: receive enriched payloads from overlay, resolve Tier 2/3 component identity, write task files, optionally trigger Claude Code, stream status back via WebSocket.

```typescript
import express from 'express'
import { WebSocketServer } from 'ws'
import { writeFile, mkdir } from 'fs/promises'
import { exec } from 'child_process'
import { resolveFileFromHints } from './resolver'
import { loadConfig } from './config'

const app = express()
const config = loadConfig()

app.use(express.json({ limit: '10mb' }))  // screenshots can be large

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// Main task endpoint
app.post('/task', async (req, res) => {
  const enrichedContext = req.body

  // Server-side resolution for Tier 2/3
  if (!enrichedContext.target.filePath && enrichedContext.target.classNameHint) {
    const resolved = await resolveFileFromHints({
      componentName: enrichedContext.target.componentName,
      classNameHint: enrichedContext.target.classNameHint,
      textContentHint: enrichedContext.target.textContentHint,
    })
    if (resolved) {
      enrichedContext.target.filePath = resolved.filePath
      enrichedContext.target.lineNumber = resolved.lineNumber
    }
  }

  // Save screenshots if present
  if (enrichedContext.screenshots) {
    await mkdir('.vibe/screenshots', { recursive: true })
    if (enrichedContext.screenshots.elementCrop) {
      await saveBase64Image(
        enrichedContext.screenshots.elementCrop,
        '.vibe/screenshots/element-crop.png'
      )
    }
    if (enrichedContext.screenshots.viewportWithBoundingBox) {
      await saveBase64Image(
        enrichedContext.screenshots.viewportWithBoundingBox,
        '.vibe/screenshots/viewport.png'
      )
    }
  }

  // Write DESIGN_TASK.md
  const taskMd = renderDesignTask(enrichedContext)
  await writeFile('.vibe/tasks/DESIGN_TASK.md', taskMd)

  // Broadcast status to overlay
  broadcastStatus({ type: 'status', state: 'pending', message: 'Task written' })

  // Auto-trigger Claude Code if configured
  if (config.autoTrigger) {
    broadcastStatus({ type: 'status', state: 'working', message: 'Claude Code is working...' })

    const proc = exec(
      `${config.claudeCommand} "Read and execute the design task at .vibe/tasks/DESIGN_TASK.md"`,
      { timeout: 120000 }
    )

    proc.stdout?.on('data', (data) => {
      broadcastStatus({ type: 'status', state: 'working', message: data.toString().slice(0, 200) })
    })

    proc.on('close', (code) => {
      broadcastStatus({
        type: 'status',
        state: code === 0 ? 'done' : 'error',
        message: code === 0 ? 'Changes applied ✓' : `Claude Code exited with code ${code}`
      })
    })
  }

  res.json({ status: 'ok', taskPath: '.vibe/tasks/DESIGN_TASK.md' })
})

// WebSocket for status feedback to overlay
const wss = new WebSocketServer({ noServer: true })
const clients = new Set()

wss.on('connection', (ws) => {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
})

function broadcastStatus(msg) {
  const data = JSON.stringify(msg)
  clients.forEach(ws => ws.send(data))
}

// WebSocket message protocol:
// { type: 'status', state: 'pending' | 'working' | 'done' | 'error', message?: string }

const server = app.listen(config.port, () => {
  console.log(`Vibe Design server running on port ${config.port}`)
})

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request)
  })
})
```

---

### 4.9 Next.js Adapter

```typescript
// next.config.js plugin
export function withVibeDesign(nextConfig = {}) {
  if (process.env.NODE_ENV !== 'development') return nextConfig

  return {
    ...nextConfig,
    async rewrites() {
      const existing = await nextConfig.rewrites?.() ?? []
      return [
        ...existing,
        { source: '/__vibe/:path*', destination: 'http://localhost:2337/:path*' }
      ]
    },
    webpack(config, { dev, isServer }) {
      if (dev && !isServer) {
        // Inject overlay script into client bundle
        config.entry = injectOverlay(config.entry)
      }
      return nextConfig.webpack?.(config, { dev, isServer }) ?? config
    }
  }
}
```

---

### 4.10 Claude Code Skills Integration

Written to `.claude/skills/vibe-design/VIBE_DESIGN.md`:

```markdown
# Vibe Design — Claude Code Skill

When you see "design task" or are pointed at DESIGN_TASK.md:

1. Read `.vibe/tasks/DESIGN_TASK.md` fully — intent section first
2. If screenshots are present, view them to understand the visual problem
3. Read relevant skills:
   - `.vibe/skills/TAILWIND.md` — always read for Tailwind projects
   - `.vibe/skills/COMPONENTS.md` — read if component library detected
   - `.vibe/skills/CONVENTIONS.md` — always read
4. Open the target file at the specified line
5. Consider the enrichment context and computed styles
6. Make the minimal change that satisfies the design intent
7. Respect all constraints listed in the task
8. If the component is shared (used in multiple files):
   - Check that the change works across all usage locations
   - If change would break other usages, create a variant instead
9. After changes:
   - Update DESIGN_TASK.md status to "done"
   - Add "Changes Made" section describing what changed and why
   - Note any convention violations that were fixed
10. Never change component APIs (props interface) without noting it
11. Prefer project conventions (semantic tokens, CVA patterns) over ad-hoc classes
```

---

## 5. Implementation Phases

### Phase 1 — MVP: The Enriched Loop (1 weekend)
**Goal:** Prove that enriched context makes Claude Code produce better design changes. End-to-end working on Next.js + Tailwind.

**Scope:**
- [ ] Overlay script with Shadow DOM isolation
- [ ] Element picker with blue outline + component label
- [ ] React fiber extraction (Tier 1) + DOM heuristic fallback (Tier 2) + class search (Tier 3)
- [ ] Enrichment engine: all 7 layers (intent, identity, current state, design context, structural, constraints, usage)
- [ ] Computed styles extraction (20 key properties)
- [ ] Prompt panel with text input, constraint toggles, and "Preview enriched prompt"
- [ ] Quick action buttons (Typography, Color, Spacing — at least 3)
- [ ] Optional screenshot toggle (html2canvas, element crop + viewport with bounding box)
- [ ] Intent augmentation (contrast ratio, font size, spacing detection)
- [ ] Local vibe server: receive payload, resolve Tier 2/3 hints, write DESIGN_TASK.md
- [ ] Next.js adapter (withVibeDesign wrapper)
- [ ] CLI: `init` (stack detection + skill generation + adapter injection) and `start` (server + overlay)
- [ ] Stack detector: Next.js, Tailwind, shadcn, TypeScript
- [ ] Skill generator: TAILWIND.md, COMPONENTS.md, CONVENTIONS.md with real values
- [ ] Claude Code skill: VIBE_DESIGN.md written to `.claude/skills/`
- [ ] WebSocket status feedback (pending → working → done/error)
- [ ] Auto-trigger Claude Code (opt-in via config)

**Not in Phase 1:**
- Multi-select (Shift+click)
- Task history
- `sync`, `detect`, `eject` commands
- Vite/Remix adapters
- Component usage counting (hardcode to "unknown" for now)

**Success metrics:**
- Click an element, describe a change → Claude Code makes it correctly
- Enriched prompt produces noticeably better results than plain text prompt
- Setup on a real Next.js + Tailwind project takes < 2 minutes
- Component file detection accuracy > 90%

---

### Phase 2 — Polish + Full CLI (1 week)
**Goal:** Production-quality CLI, full skill generation, multi-select

- [ ] `sync` command (re-run detection after adding deps)
- [ ] `detect` command (print stack without changes)
- [ ] `eject` command (remove overlay, keep skills)
- [ ] Multi-select (Shift+click) with multi-element enrichment
- [ ] Component usage counting (actual import analysis via AST)
- [ ] Task history in `.vibe/tasks/history/`
- [ ] Better Tailwind token extraction (full theme.extend parsing)
- [ ] CVA variant detection in component scanner
- [ ] Design system token cross-referencing in enrichment

---

### Phase 3 — Framework Expansion
**Goal:** Works beyond Next.js

- [ ] Vite + React adapter
- [ ] Remix adapter
- [ ] Framework-agnostic HTTP proxy (fallback for anything)
- [ ] Vue DevTools fiber equivalent
- [ ] SvelteKit adapter

---

## 6. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Injected script vs browser extension | Injected script | Zero friction — no install, no permissions. Works after `npx init`. Can be npm package. |
| Local server vs direct file writes | Local server | Browser can't write files. Enables WebSocket feedback. Clean separation of concerns. |
| DESIGN_TASK.md vs Claude Code API | Markdown file | Claude Code's native interface. Human-readable. Creates decision history. |
| Generated skills vs static templates | Generated | Real tokens, real conventions, real component names. Output quality scales with context quality. |
| Screenshots default on vs off | Off by default | Most tasks are structural ("make this bolder") not visual ("this looks cheap"). Reduces latency. Toggle on when needed. |
| Shadow DOM vs regular DOM for overlay | Shadow DOM | Prevents CSS collisions in both directions. Essential for reliability. |
| Enrichment engine in browser vs server | Browser (with server assist) | Browser has access to computed styles, fiber, DOM. Server helps with file resolution. |

---

## 7. Open Questions

| Question | Options | Current thinking |
|----------|---------|-----------------|
| RSC support? | Server components have no fiber | Fall back to Tier 2/3. Most design work is on client components anyway. |
| Monorepo support? | Single vs multiple package.json | Detect root, allow per-package `.vibe/config.json`. Phase 2. |
| Vue/Svelte fiber equivalent? | Different internals | Phase 3 research item. Vue has `__vue__` internals, Svelte has compiler metadata. |
| Intent augmentation scope? | Simple heuristics vs LLM-based | Start with simple heuristics (contrast, font-size). Evaluate LLM augmentation later. |

---

## 8. File Structure After Init

```
your-project/
├── .vibe/
│   ├── config.json             ← configuration (port, autoTrigger, etc.)
│   ├── skills/
│   │   ├── TAILWIND.md         ← generated from your tailwind.config.ts
│   │   ├── COMPONENTS.md       ← generated from your component library
│   │   └── CONVENTIONS.md      ← generated from your file patterns
│   ├── tasks/
│   │   └── DESIGN_TASK.md      ← current task (written by enrichment engine)
│   └── screenshots/            ← only populated when screenshots enabled
│       ├── element-crop.png
│       └── viewport.png
├── .claude/
│   └── skills/
│       └── vibe-design/
│           └── VIBE_DESIGN.md  ← master Claude Code skill
├── next.config.js              ← modified by init (withVibeDesign wrapper)
└── package.json                ← vibe-design added to devDependencies
```

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Time from click to Claude Code executing | < 30 seconds |
| Enriched prompt quality vs plain text prompt | Measurably better results (A/B test manually) |
| Setup time on new Next.js project | < 2 minutes |
| Component file detection accuracy (Tier 1) | > 95% |
| Component file detection accuracy (Tier 2+3 fallback) | > 70% |
| Skills accuracy (tokens, conventions) | > 90% |

---

## 10. Out of Scope (v1)

- Design history / undo
- Team collaboration / cloud sync
- AI-powered design suggestions (proactive, not reactive)
- Non-React frameworks (Phase 3)
- Production deployment inspection
- Figma / design tool integration
- Visual regression testing
- LLM-based intent augmentation (simple heuristics only for now)

---

*This document is a living PRD. Update after each phase retrospective.*
