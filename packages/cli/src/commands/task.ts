import chalk from 'chalk'
import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { join } from 'path'

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function taskCommand(
  projectDir: string,
  options: {
    file?: string
    line?: number
    intent: string
  }
): Promise<void> {
  console.log('')
  console.log(chalk.bold('  🎨 Vibe Design — Manual Task'))
  console.log('')

  const configPath = join(projectDir, '.vibe', 'config.json')
  if (!(await fileExists(configPath))) {
    console.log(chalk.red('  Error: Project not initialized.'))
    console.log(chalk.gray('  Run: npx vibe-design init'))
    process.exit(1)
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const taskContent = `# Design Task
Generated: ${now}
Status: pending

## Design Intent
"${options.intent}"

Constraints:
- [x] Tailwind only (no new CSS files)
- [x] Keep WCAG AA contrast
- [ ] Allow new dependencies
- [ ] Allow new files

## Target Component
${options.file ? `**File:** \`${options.file}${options.line ? ':' + options.line : ''}\`` : '**File:** Not specified — Claude Code should find the relevant file based on the intent.'}
Resolution method: manual (CLI)

## Applicable Skills
Read before making changes:
- .vibe/skills/TAILWIND.md — design tokens and spacing conventions
- .vibe/skills/COMPONENTS.md — component patterns and CVA conventions
- .vibe/skills/CONVENTIONS.md — project-specific rules
`

  const tasksDir = join(projectDir, '.vibe', 'tasks')
  await mkdir(tasksDir, { recursive: true })
  const taskPath = join(tasksDir, 'DESIGN_TASK.md')
  await writeFile(taskPath, taskContent)

  console.log(chalk.green(`  ✓ Task written to .vibe/tasks/DESIGN_TASK.md`))
  console.log('')
  console.log(chalk.gray('  Intent: ') + options.intent)
  if (options.file) {
    console.log(chalk.gray('  File:   ') + options.file)
  }
  console.log('')
  console.log(chalk.bold('  Next:'))
  console.log(chalk.gray('  Run Claude Code to execute:'))
  console.log(chalk.gray('    claude "Read and execute the design task at .vibe/tasks/DESIGN_TASK.md"'))
  console.log('')
}
