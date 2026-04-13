import chalk from 'chalk'
import { readFile, writeFile, rm, access } from 'fs/promises'
import { join } from 'path'
import ora from 'ora'

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function ejectCommand(projectDir: string): Promise<void> {
  console.log('')
  console.log(chalk.bold('  🎨 Vibe Design — Eject'))
  console.log('')

  // Step 1: Remove next.config wrapper
  const adapterSpinner = ora('Removing Next.js adapter...').start()
  try {
    await removeNextAdapter(projectDir)
    adapterSpinner.succeed('Removed Next.js adapter wrapper')
  } catch {
    adapterSpinner.warn('Could not remove adapter (manual cleanup may be needed)')
  }

  // Step 2: Remove transient files
  const cleanSpinner = ora('Cleaning up transient files...').start()
  try {
    const tasksDir = join(projectDir, '.vibe', 'tasks')
    const screenshotsDir = join(projectDir, '.vibe', 'screenshots')

    if (await fileExists(tasksDir)) {
      await rm(tasksDir, { recursive: true })
    }
    if (await fileExists(screenshotsDir)) {
      await rm(screenshotsDir, { recursive: true })
    }
    cleanSpinner.succeed('Removed .vibe/tasks/ and .vibe/screenshots/')
  } catch {
    cleanSpinner.warn('Could not fully clean transient files')
  }

  console.log('')
  console.log(chalk.green.bold('  ✓ Ejected.'))
  console.log('')
  console.log(chalk.bold('  Kept:'))
  console.log(chalk.gray('    .vibe/skills/        — useful standalone Claude Code context'))
  console.log(chalk.gray('    .vibe/config.json     — configuration'))
  console.log(chalk.gray('    .claude/skills/       — Claude Code skill (still works with manual tasks)'))
  console.log('')
  console.log(chalk.gray('  You can still create manual tasks with:'))
  console.log(chalk.gray('    npx vibe-design task "make the header more compact"'))
  console.log('')
}

async function removeNextAdapter(projectDir: string): Promise<void> {
  const configFiles = ['next.config.ts', 'next.config.mjs', 'next.config.js']

  for (const file of configFiles) {
    const fullPath = join(projectDir, file)
    if (await fileExists(fullPath)) {
      let content = await readFile(fullPath, 'utf-8')
      if (content.includes('withVibeDesign')) {
        // Remove import line
        content = content.replace(
          /import\s*\{?\s*withVibeDesign\s*\}?\s*from\s*['"]@vibe-design\/adapter-nextjs['"]\s*\n?/,
          ''
        )
        content = content.replace(
          /const\s*\{?\s*withVibeDesign\s*\}?\s*=\s*require\s*\(\s*['"]@vibe-design\/adapter-nextjs['"]\s*\)\s*\n?/,
          ''
        )

        // Unwrap withVibeDesign(X) → X
        content = content.replace(/withVibeDesign\(([^)]+)\)/g, '$1')

        await writeFile(fullPath, content)
        return
      }
    }
  }
}
