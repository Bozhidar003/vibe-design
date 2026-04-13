import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { join } from 'path'
import chalk from 'chalk'

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

export async function designSystemCommand(
  projectDir: string,
  action: string,
  value?: string
): Promise<void> {
  const dsPath = join(projectDir, '.vibe', 'design-system.json')

  let ds: { rules: string[]; updatedAt?: string } = { rules: [] }
  if (await fileExists(dsPath)) {
    try {
      ds = JSON.parse(await readFile(dsPath, 'utf-8'))
    } catch { /* fresh start */ }
  }

  if (action === 'list') {
    console.log('')
    console.log(chalk.bold('  📐 Design System Rules'))
    console.log('')
    if (ds.rules.length === 0) {
      console.log(chalk.gray('  No rules defined yet.'))
      console.log(chalk.gray('  Add one with: npx vibe-design design-system add "Use rounded-xl for all cards"'))
    } else {
      ds.rules.forEach((rule, i) => {
        console.log(`  ${chalk.cyan(String(i + 1) + '.')} ${rule}`)
      })
    }
    console.log('')
    return
  }

  if (action === 'add' && value) {
    ds.rules.push(value)
    ds.updatedAt = new Date().toISOString()
    await mkdir(join(projectDir, '.vibe'), { recursive: true })
    await writeFile(dsPath, JSON.stringify(ds, null, 2))
    console.log(chalk.green(`  ✓ Added: "${value}"`))
    console.log(chalk.gray(`  Total rules: ${ds.rules.length}`))
    return
  }

  if (action === 'remove' && value) {
    const idx = parseInt(value) - 1
    if (idx >= 0 && idx < ds.rules.length) {
      const removed = ds.rules.splice(idx, 1)
      ds.updatedAt = new Date().toISOString()
      await writeFile(dsPath, JSON.stringify(ds, null, 2))
      console.log(chalk.yellow(`  ✗ Removed: "${removed[0]}"`))
    } else {
      console.log(chalk.red(`  Invalid index. Use: npx vibe-design design-system list`))
    }
    return
  }

  if (action === 'init') {
    const defaultRules = [
      'Use rounded-lg for cards, rounded-full for buttons and pills',
      'Primary color: blue-600, use consistently for CTAs',
      'Spacing: p-4 for cards, p-6 for sections, gap-4 for lists',
      'Typography: text-sm for labels, text-base for body, text-xl for headings',
      'Always include hover: and focus: states on interactive elements',
      'Use shadow-sm for subtle elevation, shadow-md for cards',
      'Transitions: transition-colors duration-150 for color changes',
    ]
    ds.rules = defaultRules
    ds.updatedAt = new Date().toISOString()
    await mkdir(join(projectDir, '.vibe'), { recursive: true })
    await writeFile(dsPath, JSON.stringify(ds, null, 2))
    console.log(chalk.green(`  ✓ Initialized with ${defaultRules.length} default rules`))
    console.log(chalk.gray('  Edit .vibe/design-system.json or use:'))
    console.log(chalk.gray('    npx vibe-design design-system add "Your rule"'))
    return
  }

  console.log(chalk.red('  Unknown action. Use: list, add, remove, init'))
}
