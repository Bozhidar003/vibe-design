import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { join } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import { detectStack, type DetectedStack } from '@vibe-design/detector'
import {
  generateSkills,
  generateVibeConfig,
  generateClaudeSkill,
} from '@vibe-design/skill-generator'

const FRONTEND_DESIGN_SKILL = `# Frontend Design Skill

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics. When making design changes, implement real working code with exceptional attention to aesthetic details and creative choices.

## Design Thinking

Before making changes, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Match the existing design language, or if the user asks for improvement, pick an intentional direction: brutally minimal, maximalist, retro-futuristic, organic/natural, luxury/refined, playful, editorial, brutalist, art deco, soft/pastel, industrial, etc.
- **Differentiation**: What makes this UNFORGETTABLE? Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

## Aesthetics Guidelines

- **Typography**: Choose fonts that are beautiful and distinctive. Avoid generic fonts like Arial and Inter. Pair a distinctive display font with a refined body font. Use letter-spacing (tracking) intentionally.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations and micro-interactions. Focus on high-impact moments: staggered reveals on page load, scroll-triggered effects, surprising hover states. Prefer CSS transitions for simple effects.
- **Spatial Composition**: Consider asymmetry, overlap, diagonal flow, grid-breaking elements. Generous negative space OR controlled density — both work when intentional.
- **Backgrounds & Visual Details**: Create atmosphere and depth. Use gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders.

## Anti-Patterns to Avoid

NEVER use:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Cliched color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and cookie-cutter component patterns
- Generic aesthetics that lack context-specific character

Every design change should feel intentionally crafted for the specific context. Match implementation complexity to the aesthetic vision — maximalist designs need elaborate code, minimalist designs need precision and restraint.
`

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function initCommand(projectDir: string): Promise<void> {
  console.log('')
  console.log(chalk.bold('  🎨 Vibe Design — Init'))
  console.log(chalk.gray('  Click what\'s broken. Describe what you want. Claude fixes it.'))
  console.log('')

  // Step 1: Detect stack
  const detectSpinner = ora('Detecting project stack...').start()
  let stack: DetectedStack

  try {
    stack = await detectStack(projectDir)
    detectSpinner.succeed('Stack detected')
  } catch (err) {
    detectSpinner.fail('Failed to detect stack')
    console.error(chalk.red(`  Error: ${(err as Error).message}`))
    process.exit(1)
  }

  // Print detection summary
  console.log('')
  console.log(chalk.gray('  ┌─────────────────────────────────────┐'))
  console.log(chalk.gray('  │') + chalk.bold('  Detected Stack                      ') + chalk.gray('│'))
  console.log(chalk.gray('  ├─────────────────────────────────────┤'))
  console.log(chalk.gray('  │') + `  Framework:   ${padRight(formatFramework(stack), 22)}` + chalk.gray('│'))
  console.log(chalk.gray('  │') + `  CSS:         ${padRight(formatCSS(stack), 22)}` + chalk.gray('│'))
  console.log(chalk.gray('  │') + `  Components:  ${padRight(stack.components, 22)}` + chalk.gray('│'))
  console.log(chalk.gray('  │') + `  TypeScript:  ${padRight(stack.typescript ? 'yes' : 'no', 22)}` + chalk.gray('│'))
  console.log(chalk.gray('  │') + `  Source dir:  ${padRight(stack.srcDir, 22)}` + chalk.gray('│'))
  console.log(chalk.gray('  │') + `  Components:  ${padRight(String(stack.componentPatterns.length) + ' found', 22)}` + chalk.gray('│'))
  console.log(chalk.gray('  │') + `  Tokens:      ${padRight(String(stack.designTokens.length) + ' found', 22)}` + chalk.gray('│'))
  console.log(chalk.gray('  └─────────────────────────────────────┘'))
  console.log('')

  // Step 2: Generate .vibe/ directory
  // Step 2a: Update .gitignore
  try {
    const gitignorePath = join(projectDir, '.gitignore')
    let gitignore = ''
    try { gitignore = await readFile(gitignorePath, 'utf-8') } catch { /* no .gitignore */ }

    const vibeEntries = [
      '# vibe-design (dev-only)',
      '.vibe/tasks/',
      '.vibe/screenshots/',
      '.vibe/tasks/.current-prompt.txt',
    ]

    const missing = vibeEntries.filter(e => !e.startsWith('#') && !gitignore.includes(e))
    if (missing.length > 0) {
      const block = '\n' + vibeEntries.join('\n') + '\n'
      await writeFile(gitignorePath, gitignore.trimEnd() + block)
    }
  } catch {
    // Non-critical
  }

  const genSpinner = ora('Generating .vibe/ configuration...').start()

  try {
    const vibeDir = join(projectDir, '.vibe')
    await mkdir(vibeDir, { recursive: true })
    await mkdir(join(vibeDir, 'tasks'), { recursive: true })
    await mkdir(join(vibeDir, 'screenshots'), { recursive: true })

    // Write config
    const configContent = generateVibeConfig(stack)
    await writeFile(join(vibeDir, 'config.json'), configContent)

    // Generate skills
    await generateSkills(projectDir, stack)

    genSpinner.succeed('Generated .vibe/ configuration and skills')
  } catch (err) {
    genSpinner.fail('Failed to generate .vibe/ configuration')
    console.error(chalk.red(`  Error: ${(err as Error).message}`))
    process.exit(1)
  }

  // Step 3: Write Claude Code skills
  const skillSpinner = ora('Writing Claude Code skills...').start()

  try {
    const claudeSkillDir = join(projectDir, '.claude', 'skills', 'vibe-design')
    await mkdir(claudeSkillDir, { recursive: true })
    await writeFile(join(claudeSkillDir, 'VIBE_DESIGN.md'), generateClaudeSkill())
    await writeFile(join(claudeSkillDir, 'FRONTEND_DESIGN.md'), FRONTEND_DESIGN_SKILL)
    skillSpinner.succeed('Written Claude Code skills (VIBE_DESIGN.md + FRONTEND_DESIGN.md)')
  } catch (err) {
    skillSpinner.fail('Failed to write Claude Code skills')
    console.error(chalk.red(`  Error: ${(err as Error).message}`))
  }

  // Step 3b: Initialize design system with defaults
  const dsSpinner = ora('Initializing design system...').start()
  try {
    const dsPath = join(projectDir, '.vibe', 'design-system.json')
    if (!(await fileExists(dsPath))) {
      const defaultDS = {
        rules: [
          'Use rounded-lg for cards, rounded-full for buttons and pills',
          'Spacing: p-4 for cards, p-6 for sections, gap-4 for lists',
          'Typography: text-sm for labels, text-base for body, text-xl+ for headings',
          'Always include hover: and focus: states on interactive elements',
          'Use shadow-sm for subtle elevation, shadow-md for cards, shadow-lg for modals',
          'Transitions: transition-colors duration-150 for color changes',
          'Prefer semantic color tokens over raw Tailwind colors when available',
          'Design should be distinctive and intentional — avoid generic AI aesthetics',
        ],
        updatedAt: new Date().toISOString(),
      }
      await writeFile(dsPath, JSON.stringify(defaultDS, null, 2))
      dsSpinner.succeed('Initialized design system with defaults')
    } else {
      dsSpinner.succeed('Design system already exists')
    }
  } catch (err) {
    dsSpinner.warn('Could not initialize design system')
  }

  // Step 4: Inject framework adapter
  if (stack.framework === 'nextjs') {
    const adapterSpinner = ora('Injecting Next.js adapter...').start()
    try {
      await injectNextAdapter(projectDir, stack)
      await injectOverlayLoader(projectDir, stack)
      adapterSpinner.succeed('Next.js adapter + overlay loader injected')
    } catch (err) {
      adapterSpinner.warn(`Could not auto-inject adapter: ${(err as Error).message}`)
      console.log(chalk.yellow('  Manual setup needed — see .vibe/skills/CONVENTIONS.md'))
    }
  } else if (stack.framework === 'vite-react') {
    const adapterSpinner = ora('Injecting Vite adapter...').start()
    try {
      await injectViteAdapter(projectDir)
      adapterSpinner.succeed('Vite adapter injected')
    } catch (err) {
      adapterSpinner.warn(`Could not auto-inject adapter: ${(err as Error).message}`)
      printManualAdapterInstructions('vite', stack)
    }
  } else if (stack.framework === 'sveltekit') {
    const adapterSpinner = ora('Injecting SvelteKit adapter...').start()
    try {
      await injectSvelteKitAdapter(projectDir)
      adapterSpinner.succeed('SvelteKit adapter injected')
    } catch (err) {
      adapterSpinner.warn(`Could not auto-inject adapter: ${(err as Error).message}`)
      printManualAdapterInstructions('sveltekit', stack)
    }
  } else if (stack.framework === 'remix') {
    console.log(chalk.yellow('  Remix detected — add the adapter manually:'))
    printManualAdapterInstructions('remix', stack)
  } else if (stack.framework !== 'unknown') {
    console.log(chalk.yellow(`  ${stack.framework} detected — use the proxy adapter:`))
    console.log(chalk.gray('    npx vibe-proxy --target http://localhost:3000'))
  }

  // Step 5: Print next steps
  console.log('')
  console.log(chalk.green.bold('  ✓ Vibe Design initialized!'))
  console.log('')
  console.log(chalk.bold('  Next steps:'))
  console.log('')
  console.log(chalk.cyan('  1.') + ' Start the vibe server:')
  console.log(chalk.gray('     npx vibe-design start'))
  console.log('')
  console.log(chalk.cyan('  2.') + ' Start your dev server (separate terminal):')
  console.log(chalk.gray('     npm run dev'))
  console.log('')
  console.log(chalk.cyan('  3.') + ' Open your app and press ' + chalk.bold('⌘D') + ' to enter Design Mode')
  console.log('')
  console.log(chalk.cyan('  4.') + ' Click any element and describe what you want to change')
  console.log('')

  // Print generated files
  console.log(chalk.gray('  Generated files:'))
  console.log(chalk.gray('    .vibe/config.json'))
  console.log(chalk.gray('    .vibe/skills/CONVENTIONS.md'))
  if (stack.css === 'tailwind') {
    console.log(chalk.gray('    .vibe/skills/TAILWIND.md'))
  }
  if (stack.componentPatterns.length > 0) {
    console.log(chalk.gray('    .vibe/skills/COMPONENTS.md'))
  }
  console.log(chalk.gray('    .claude/skills/vibe-design/VIBE_DESIGN.md'))
  console.log('')
}

async function injectOverlayLoader(projectDir: string, stack: DetectedStack): Promise<void> {
  const layoutPaths = [
    join(projectDir, stack.srcDir || 'src/', 'app', 'layout.tsx'),
    join(projectDir, stack.srcDir || 'src/', 'app', 'layout.jsx'),
    join(projectDir, 'app', 'layout.tsx'),
    join(projectDir, 'app', 'layout.jsx'),
  ]

  for (const layoutPath of layoutPaths) {
    if (await fileExists(layoutPath)) {
      let content = await readFile(layoutPath, 'utf-8')
      if (content.includes('vibe-design')) return // already injected

      // Add Script import from next/script
      if (!content.includes('next/script')) {
        const lastImportIdx = content.lastIndexOf('\nimport ')
        if (lastImportIdx !== -1) {
          const endOfLine = content.indexOf('\n', lastImportIdx + 1)
          content = content.slice(0, endOfLine + 1) + `import Script from "next/script"\n` + content.slice(endOfLine + 1)
        }
      }

      // Add Script tag before </body>
      content = content.replace(
        /<\/body>/,
        `{/* vibe-design overlay */}\n        {process.env.NODE_ENV === "development" && (\n          <Script src="http://localhost:2337/overlay.js" strategy="lazyOnload" />\n        )}\n      </body>`
      )

      await writeFile(layoutPath, content)
      return
    }
  }
}

// Inline adapter — no external package needed
const VIBE_ADAPTER_INLINE = `
// --- vibe-design adapter (injected by npx vibe-design init) ---
function withVibeDesign(nextConfig = {}) {
  if (process.env.NODE_ENV !== 'development') return nextConfig;
  return {
    ...nextConfig,
    async rewrites() {
      const existing = await (nextConfig.rewrites?.() ?? Promise.resolve([]));
      const vibeRewrites = [{ source: '/__vibe/:path*', destination: 'http://localhost:2337/:path*' }];
      return Array.isArray(existing) ? [...existing, ...vibeRewrites] : { ...existing, fallback: [...(existing.fallback ?? []), ...vibeRewrites] };
    },
    async headers() {
      const existing = await (nextConfig.headers?.() ?? Promise.resolve([]));
      return [...existing, { source: '/(.*)', headers: [{ key: 'x-vibe-design', value: 'active' }] }];
    },
  };
}
// --- end vibe-design adapter ---
`

async function injectNextAdapter(
  projectDir: string,
  stack: DetectedStack
): Promise<void> {
  const configFiles = [
    'next.config.ts',
    'next.config.mjs',
    'next.config.js',
  ]

  let configPath: string | null = null
  let configContent = ''

  for (const file of configFiles) {
    const fullPath = join(projectDir, file)
    if (await fileExists(fullPath)) {
      configPath = fullPath
      configContent = await readFile(fullPath, 'utf-8')
      break
    }
  }

  if (!configPath) {
    configPath = join(projectDir, 'next.config.mjs')
    const newConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {}
${VIBE_ADAPTER_INLINE}
export default withVibeDesign(nextConfig)
`
    await writeFile(configPath, newConfig)
    return
  }

  // Check if already injected
  if (configContent.includes('withVibeDesign')) {
    return
  }

  // Inject the inline adapter function + wrap the export
  const isESM =
    configPath.endsWith('.mjs') ||
    configPath.endsWith('.ts') ||
    configContent.includes('export default')

  if (isESM) {
    const modified = configContent.replace(
      /export\s+default\s+([^;\n]+);?/,
      `${VIBE_ADAPTER_INLINE}\nexport default withVibeDesign($1)`
    )
    await writeFile(configPath, modified)
  } else {
    const modified = configContent.replace(
      /module\.exports\s*=\s*([^;\n]+);?/,
      `${VIBE_ADAPTER_INLINE}\nmodule.exports = withVibeDesign($1)`
    )
    await writeFile(configPath, modified)
  }
}

async function injectViteAdapter(projectDir: string): Promise<void> {
  const configFiles = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']

  for (const file of configFiles) {
    const fullPath = join(projectDir, file)
    if (await fileExists(fullPath)) {
      let content = await readFile(fullPath, 'utf-8')
      if (content.includes('vibeDesign')) return

      const importLine = `import { vibeDesign } from '@vibe-design/adapter-vite'\n`

      // Insert plugin into plugins array
      content = importLine + content.replace(
        /plugins\s*:\s*\[/,
        'plugins: [vibeDesign(), '
      )
      await writeFile(fullPath, content)
      return
    }
  }
  throw new Error('No vite.config file found')
}

async function injectSvelteKitAdapter(projectDir: string): Promise<void> {
  const configFiles = ['vite.config.ts', 'vite.config.js']

  for (const file of configFiles) {
    const fullPath = join(projectDir, file)
    if (await fileExists(fullPath)) {
      let content = await readFile(fullPath, 'utf-8')
      if (content.includes('vibeDesignSvelteKit')) return

      const importLine = `import { vibeDesignSvelteKit } from '@vibe-design/adapter-sveltekit'\n`

      content = importLine + content.replace(
        /plugins\s*:\s*\[/,
        'plugins: [vibeDesignSvelteKit(), '
      )
      await writeFile(fullPath, content)
      return
    }
  }
  throw new Error('No vite.config file found')
}

function printManualAdapterInstructions(type: string, _stack: DetectedStack): void {
  const instructions: Record<string, string[]> = {
    vite: [
      "  Add to your vite.config.ts:",
      "    import { vibeDesign } from '@vibe-design/adapter-vite'",
      "    plugins: [vibeDesign(), ...]",
    ],
    sveltekit: [
      "  Add to your vite.config.ts:",
      "    import { vibeDesignSvelteKit } from '@vibe-design/adapter-sveltekit'",
      "    plugins: [sveltekit(), vibeDesignSvelteKit()]",
    ],
    remix: [
      "  For Remix v2 (Vite), add to vite.config.ts:",
      "    import { vibeDesignRemix } from '@vibe-design/adapter-remix'",
      "    plugins: [remix(), vibeDesignRemix()]",
      "",
      "  For Remix v1, add to entry.client.tsx:",
      "    import { injectVibeOverlay } from '@vibe-design/adapter-remix'",
      "    injectVibeOverlay()",
    ],
  }

  const lines = instructions[type] || [
    "  Use the proxy adapter:",
    "    npx vibe-proxy --target http://localhost:3000",
  ]

  for (const line of lines) {
    console.log(chalk.gray(line))
  }
}

function formatFramework(stack: DetectedStack): string {
  const names: Record<string, string> = {
    nextjs: 'Next.js',
    'vite-react': 'Vite + React',
    nuxt: 'Nuxt',
    remix: 'Remix',
    sveltekit: 'SvelteKit',
    svelte: 'Svelte',
    unknown: 'Unknown',
  }
  const name = names[stack.framework] || stack.framework
  const version = stack.frameworkVersion ? ` v${stack.frameworkVersion}` : ''
  const router = stack.router ? ` (${stack.router} router)` : ''
  return `${name}${version}${router}`
}

function formatCSS(stack: DetectedStack): string {
  if (stack.css === 'tailwind') {
    return `Tailwind${stack.tailwindVersion ? ' v' + stack.tailwindVersion : ''}`
  }
  return stack.css
}

function padRight(str: string, len: number): string {
  return str.padEnd(len)
}
