# Vibe Design

[![npm version](https://img.shields.io/npm/v/@bozhidar003/vibe-design.svg)](https://www.npmjs.com/package/@bozhidar003/vibe-design)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**Click what's broken. Describe what you want. Claude fixes it.**

Vibe Design injects a design overlay into your dev server. Click any element, say what you want to change, and Claude Code edits the code for you — with full context about your component, styles, design tokens, and conventions.

## Install

```bash
npm install -g @bozhidar003/vibe-design
```

Or use directly with npx:

```bash
npx @bozhidar003/vibe-design setup ~/my-project
```

## Quick Start

**Terminal 1** — start vibe-design:
```bash
vibe-design setup ~/my-project
```

**Terminal 2** — start your dev server:
```bash
cd ~/my-project && npm run dev
```

Open your app in the browser. Press **Cmd+D**. Click any element. Type what you want. Hit Send.

> If you're already inside your project directory, just run `vibe-design setup` with no arguments.

## Simple Mode

Skip the FAB button and quick actions. Just hover, click, type:

```bash
vibe-design start --simple --dir /path/to/your/project
```

## What Happens When You Click Send

1. The overlay collects the element's component name, file path, CSS classes, computed styles, parent layout, and your design system rules
2. It detects issues automatically — low contrast, missing hover states, inconsistent tokens
3. If you say "make this better", it adds specific suggestions based on what's missing
4. Claude Code receives all of this as a single prompt, edits the file, and your dev server hot-reloads

## Commands

```bash
vibe-design init                    # Detect stack, generate config + skills
vibe-design start                   # Start server (add --simple for minimal UI)
vibe-design sync                    # Regenerate skills after adding deps
vibe-design detect                  # Print detected stack
vibe-design task "change this"      # Create a task from CLI
vibe-design eject                   # Remove overlay, keep skills
vibe-design design-system list      # Show design rules
vibe-design design-system add "..." # Add a rule enforced in every prompt
```

All commands accept `--dir <path>` to target a project.

## Design System

Rules you define are included in every prompt to Claude:

```bash
vibe-design design-system add "Buttons use rounded-full" --dir ./my-project
vibe-design design-system add "Primary color is blue-600" --dir ./my-project
```

`init` creates sensible defaults. Edit `.vibe/design-system.json` directly or use the CLI.

## What init Creates

```
your-project/
├── .vibe/
│   ├── config.json              # Server config
│   ├── design-system.json       # Your design rules
│   └── skills/
│       ├── TAILWIND.md          # Extracted design tokens
│       ├── COMPONENTS.md        # Component index
│       └── CONVENTIONS.md       # Project patterns
├── .claude/skills/vibe-design/
│   ├── VIBE_DESIGN.md           # Task execution skill
│   └── FRONTEND_DESIGN.md      # Design quality skill
└── next.config.ts               # Adapter (dev-only, no-op in production)
```

## Supported Stacks

| | Detected |
|---|---|
| **Frameworks** | Next.js, Vite, Remix, Nuxt, SvelteKit |
| **CSS** | Tailwind (with config parsing), CSS Modules, styled-components, Emotion |
| **Components** | shadcn/ui, Radix, Mantine, Chakra, MUI |
| **Resolution** | React Fiber, Vue internals, Svelte metadata, DOM heuristics |

## Production

Zero impact. The overlay and adapter are gated behind `NODE_ENV === "development"` and tree-shaken out of production builds. No packages are installed in your project.

To fully remove: `vibe-design eject --dir ./my-project`

## Requirements

- Node.js >= 18
- Claude Code CLI installed and authenticated
- A web project with a dev server

## Development

```bash
git clone https://github.com/Bozhdiar003/vibe_design.git
cd vibe_design
npm install
npm run build
```

## Publishing (CI/CD)

This project uses GitHub Actions to publish to npm on release creation. Set the `NPM_TOKEN` secret in your GitHub repo settings (Settings > Secrets > Actions > New repository secret).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE) &copy; Bozhidar Kamenski
