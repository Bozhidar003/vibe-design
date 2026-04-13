# Vibe Design

**Click what's broken. Describe what you want. Claude fixes it.**

Vibe Design is a developer-first visual design tool that sits on top of Claude Code. It injects an intelligent overlay into any running web dev server, lets you click any UI element, and sends a fully-contextualized design prompt — with component source, computed styles, design tokens, and structural context — directly to Claude Code for execution.

The result: a tight **visual > intent > enriched context > code** loop that replaces mentally translating visual problems into text prompts.

---

## How It Works

```
You see a problem in the browser
  > Click the element
    > Describe what you want ("make this button better")
      > Vibe Design enriches your intent with:
        - Component file path + line number
        - Current Tailwind classes
        - Computed styles (font, color, spacing)
        - Structural context (parent layout, siblings)
        - Design system rules
        - Contrast ratio warnings
        - Missing hover/focus state detection
      > Claude Code receives the enriched prompt
        > Edits the file directly
          > Next.js hot reloads
            > You see the result instantly
```

## Quick Start

```bash
# 1. In the vibe-design repo, build everything
npm install && npm run build

# 2. Initialize on your project
npm run vibe -- init --dir /path/to/your/nextjs-project

# 3. Start the vibe server
npm run vibe -- start --dir /path/to/your/nextjs-project

# 4. Start your dev server (separate terminal)
cd /path/to/your/nextjs-project && npm run dev

# 5. Open http://localhost:3000, press Cmd+D, click anything
```

## Two Modes

### Full Mode (default)

```bash
npm run vibe -- start --dir /path/to/project
```

- Floating action button in the corner
- Press **Cmd+D** to toggle design mode
- Click element > full panel with quick actions, constraints, preview
- Shift+click for multi-element selection

### Simple Mode

```bash
npm run vibe -- start --simple --dir /path/to/project
```

- No floating button — always active
- Hover highlights elements, click opens a minimal sidebar
- Just: element label, text input, send button
- Auto-closes after Claude finishes

## CLI Commands

| Command | Description |
|---------|-------------|
| `init` | Detect stack, generate `.vibe/`, inject adapter, write Claude Code skills |
| `start` | Start the vibe server (add `--simple` for simple mode) |
| `sync` | Re-run detection and regenerate skills after adding new deps |
| `detect` | Print detected stack without making changes |
| `task <intent>` | Manually create a design task from CLI |
| `eject` | Remove overlay + adapter, keep skills |
| `design-system list` | List design system rules |
| `design-system add <rule>` | Add a design system rule |
| `design-system remove <n>` | Remove a rule by number |
| `design-system init` | Initialize with default rules |

All commands accept `--dir <path>` to target a specific project directory.

## What `init` Generates

```
your-project/
├── .vibe/
│   ├── config.json              # Server config (port, autoTrigger, etc.)
│   ├── design-system.json       # Design rules enforced in every prompt
│   ├── skills/
│   │   ├── TAILWIND.md          # Your actual design tokens (auto-extracted)
│   │   ├── COMPONENTS.md        # Component index with usage counts
│   │   └── CONVENTIONS.md       # Project patterns and file organization
│   ├── tasks/                   # Current + historical design tasks
│   └── screenshots/             # Optional element/viewport captures
├── .claude/
│   └── skills/
│       └── vibe-design/
│           ├── VIBE_DESIGN.md   # Task execution skill
│           └── FRONTEND_DESIGN.md  # Anti-AI-slop design aesthetics skill
├── next.config.ts               # Adapter injected (dev-only, no-op in production)
└── src/app/layout.tsx           # Overlay script loader (tree-shaken in production)
```

## Stack Detection

`init` automatically detects and configures for:

| Category | Detected |
|----------|----------|
| **Framework** | Next.js, Vite + React, Remix, Nuxt, SvelteKit, Svelte |
| **CSS** | Tailwind (with full config parsing), CSS Modules, styled-components, Emotion |
| **Components** | shadcn/ui, Radix, Mantine, Chakra, MUI |
| **Language** | TypeScript / JavaScript |
| **Tokens** | Colors, spacing, fontSize, borderRadius, boxShadow, fontFamily, CSS custom properties |

## Enrichment Engine

When you click an element, the overlay collects 7 layers of context:

1. **Intent** — your description + smart augmentation (contrast warnings, missing states, design suggestions)
2. **Element Identity** — React fiber resolution with framework-internal filtering, DOM heuristics fallback, class-based file search
3. **Current Styling** — 20 key computed CSS properties
4. **Design System** — token cross-referencing, convention violation detection
5. **Structural Context** — parent layout, siblings, container description
6. **Constraints** — Tailwind-only, WCAG AA, no new files
7. **Page Context** — current URL, element text content

### Smart Intent Augmentation

The enrichment engine always analyzes the element and adds relevant context:

- **Low contrast** — "Current contrast ratio is 3.2:1 (WCAG AA requires 4.5:1)"
- **Missing hover/focus** — "Interactive element should have hover: and focus: variants"
- **"Make it better"** — auto-suggests shadow, transitions, letter-spacing based on what's missing
- **Design token violations** — "Uses text-gray-400 but project has semantic tokens"

## Design System

Persistent design rules that are included in every prompt to Claude:

```bash
# Initialize with sensible defaults
npm run vibe -- design-system init --dir /path/to/project

# Add custom rules
npm run vibe -- design-system add "All CTAs use blue-600 with white text" --dir /path/to/project

# List current rules
npm run vibe -- design-system list --dir /path/to/project
```

Rules are saved in `.vibe/design-system.json` and automatically appended to every design task. Example default rules:

- Use rounded-lg for cards, rounded-full for buttons
- Always include hover: and focus: states on interactive elements
- Prefer semantic color tokens over raw Tailwind colors
- Design should be distinctive and intentional — avoid generic AI aesthetics

## Component Resolution

Three-tier resolution with framework-internal filtering:

| Tier | Method | What it finds |
|------|--------|---------------|
| 1A | React Fiber `_debugSource` | Component name, file path, line number, props |
| 1B | Vue `__vue__` / `__vueParentComponent` | Vue 2 + Vue 3 components |
| 1C | Svelte `__svelte_meta` | Svelte component metadata |
| 2 | DOM attributes (`data-testid`, `data-component`, `id`) | Component name from attributes |
| 3 | Class-based search | Server-side grep for unique class combinations |

Automatically skips 40+ framework internals (SegmentViewNode, RedirectBoundary, LayoutRouter, Suspense, Provider, etc.) plus pattern-based filtering (anything ending in `Boundary`, `Provider`, `Context`, `Router`).

## Framework Adapters

| Framework | Package | How it works |
|-----------|---------|--------------|
| **Next.js** | Inline (no package) | `withVibeDesign()` wrapper in next.config + `<Script>` in layout |
| **Vite + React** | `@vibe-design/adapter-vite` | Vite plugin with proxy + HTML injection |
| **Remix** | `@vibe-design/adapter-remix` | Vite plugin (v2) or `injectVibeOverlay()` (v1) |
| **SvelteKit** | `@vibe-design/adapter-sveltekit` | Vite plugin + `vibeDesignHandle` hook |
| **Any framework** | `@vibe-design/adapter-proxy` | HTTP proxy that intercepts HTML responses |

## Production Safety

Vibe Design has **zero production impact**:

- `withVibeDesign()` returns the config unchanged when `NODE_ENV !== 'development'`
- The `<Script>` overlay loader is tree-shaken out by Next.js in production builds
- No npm packages are installed in the target project
- No runtime code ships to production

To fully remove:

```bash
npm run vibe -- eject --dir /path/to/project
```

This removes the adapter, overlay loader, and transient files. Skills and design system are kept (useful for Claude Code without the overlay).

## Architecture

```
packages/
├── cli/              # npx vibe-design (init, start, sync, detect, task, eject, design-system)
├── overlay/          # Injected browser script (Shadow DOM isolated, ~53KB)
├── server/           # Express server on port 2337 + WebSocket
├── detector/         # Stack detection (framework, CSS, components, tokens)
├── skill-generator/  # Generates .vibe/skills/ from detection results
├── adapter-nextjs/   # Next.js withVibeDesign() wrapper
├── adapter-vite/     # Vite plugin
├── adapter-remix/    # Remix adapter (Vite + legacy)
├── adapter-sveltekit/# SvelteKit Vite plugin + handle hook
└── adapter-proxy/    # Framework-agnostic HTTP proxy
```

## Configuration

`.vibe/config.json`:

```json
{
  "port": 2337,
  "autoTrigger": true,
  "screenshotDefault": false,
  "claudeCommand": "claude",
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

| Key | Default | Description |
|-----|---------|-------------|
| `port` | `2337` | Vibe server port |
| `autoTrigger` | `true` | Automatically execute tasks via Claude Code |
| `screenshotDefault` | `false` | Include screenshots by default |
| `claudeCommand` | `"claude"` | Path to Claude Code CLI |

## Requirements

- Node.js >= 18
- Claude Code CLI installed and authenticated
- A web project with a dev server (Next.js, Vite, Remix, SvelteKit, or any)

## License

MIT
