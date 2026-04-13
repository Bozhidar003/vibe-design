import chalk from 'chalk'
import { readFile, writeFile, rm, access } from 'fs/promises'
import { join } from 'path'
import ora from 'ora'

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

export async function ejectCommand(projectDir: string): Promise<void> {
  console.log('')
  console.log(chalk.bold('  Vibe Design — Eject'))
  console.log('')

  // Step 1: Remove inline adapter from next.config
  const adapterSpinner = ora('Removing adapter from next.config...').start()
  try {
    await removeNextAdapter(projectDir)
    adapterSpinner.succeed('Cleaned next.config')
  } catch {
    adapterSpinner.warn('Could not auto-clean next.config (check manually)')
  }

  // Step 2: Remove overlay loader from layout
  const overlaySpinner = ora('Removing overlay loader from layout...').start()
  try {
    await removeOverlayLoader(projectDir)
    overlaySpinner.succeed('Cleaned layout')
  } catch {
    overlaySpinner.warn('Could not auto-clean layout (check manually)')
  }

  // Step 3: Remove transient files
  const cleanSpinner = ora('Removing dev-only files...').start()
  try {
    const toRemove = [
      join(projectDir, '.vibe', 'tasks'),
      join(projectDir, '.vibe', 'screenshots'),
    ]
    for (const p of toRemove) {
      if (await fileExists(p)) await rm(p, { recursive: true })
    }
    cleanSpinner.succeed('Removed tasks and screenshots')
  } catch {
    cleanSpinner.warn('Could not fully clean dev files')
  }

  console.log('')
  console.log(chalk.green.bold('  Done.'))
  console.log('')
  console.log(chalk.bold('  Kept (useful for Claude Code without the overlay):'))
  console.log(chalk.gray('    .vibe/skills/            — Tailwind tokens, component conventions'))
  console.log(chalk.gray('    .vibe/config.json         — configuration'))
  console.log(chalk.gray('    .vibe/design-system.json  — design rules'))
  console.log(chalk.gray('    .claude/skills/           — Claude Code skills'))
  console.log('')
  console.log(chalk.bold('  To remove everything:'))
  console.log(chalk.gray('    rm -rf .vibe .claude/skills/vibe-design'))
  console.log('')
  console.log(chalk.gray('  Your production build is unaffected — all vibe-design code'))
  console.log(chalk.gray('  is gated behind NODE_ENV === "development" checks.'))
  console.log('')
}

async function removeNextAdapter(projectDir: string): Promise<void> {
  const configFiles = ['next.config.ts', 'next.config.mjs', 'next.config.js']

  for (const file of configFiles) {
    const fullPath = join(projectDir, file)
    if (!(await fileExists(fullPath))) continue

    let content = await readFile(fullPath, 'utf-8')
    if (!content.includes('withVibeDesign')) continue

    // Remove the entire inline adapter block
    content = content.replace(
      /\n?\/\/ --- vibe-design adapter[\s\S]*?\/\/ --- end vibe-design adapter ---\n?/,
      ''
    )

    // Unwrap withVibeDesign(X) → X
    content = content.replace(/withVibeDesign\(([^)]+)\)/g, '$1')

    // Also remove the old import-based adapter if present
    content = content.replace(
      /import\s*\{?\s*withVibeDesign\s*\}?\s*from\s*['"][^'"]+['"]\s*;?\n?/g,
      ''
    )

    await writeFile(fullPath, content)
    return
  }
}

async function removeOverlayLoader(projectDir: string): Promise<void> {
  const layoutPaths = [
    join(projectDir, 'src', 'app', 'layout.tsx'),
    join(projectDir, 'src', 'app', 'layout.jsx'),
    join(projectDir, 'app', 'layout.tsx'),
    join(projectDir, 'app', 'layout.jsx'),
  ]

  for (const layoutPath of layoutPaths) {
    if (!(await fileExists(layoutPath))) continue

    let content = await readFile(layoutPath, 'utf-8')
    if (!content.includes('vibe-design')) continue

    // Remove the overlay Script block
    content = content.replace(
      /\s*\{\/\* vibe-design overlay \*\/\}\s*\{process\.env\.NODE_ENV === "development" && \(\s*<Script src="http:\/\/localhost:2337\/overlay\.js"[^/]*\/>\s*\)\}/g,
      ''
    )

    // Remove Script import if it's only used for vibe-design
    if (!content.includes('<Script') || content.match(/<Script/g)?.length === 0) {
      content = content.replace(/import Script from "next\/script"\s*;?\n?/, '')
    }

    // Remove the component import if it exists (old approach)
    content = content.replace(
      /import\s*\{?\s*VibeDesignOverlay\s*\}?\s*from\s*['"][^'"]+['"]\s*;?\n?/g,
      ''
    )
    content = content.replace(/\s*<VibeDesignOverlay\s*\/>/g, '')

    await writeFile(layoutPath, content)

    // Remove the overlay component file if it exists
    const componentPath = join(projectDir, 'src', 'components', 'vibe-design-overlay.tsx')
    if (await fileExists(componentPath)) {
      await rm(componentPath)
    }

    return
  }
}
