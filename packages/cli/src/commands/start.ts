import chalk from 'chalk'
import ora from 'ora'
import { access } from 'fs/promises'
import { join } from 'path'

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

export async function startCommand(projectDir: string, options: { simple?: boolean } = {}): Promise<void> {
  const mode = options.simple ? 'simple' : 'full'

  console.log('')
  console.log(chalk.bold(`  Vibe Design — ${mode === 'simple' ? 'Simple Mode' : 'Start'}`))
  console.log('')

  const configPath = join(projectDir, '.vibe', 'config.json')
  if (!(await fileExists(configPath))) {
    console.log(chalk.red('  Error: Project not initialized.'))
    console.log(chalk.gray('  Run: npx vibe-design init'))
    process.exit(1)
  }

  const serverSpinner = ora('Starting vibe server...').start()

  try {
    const { createVibeServer } = await import('@bozhidar003/vibe-design-server')
    const { config } = await createVibeServer(projectDir, { overlayMode: mode })

    serverSpinner.succeed(`Vibe server running on http://localhost:${config.port}`)

    console.log('')
    if (mode === 'simple') {
      console.log(chalk.bold('  Simple mode:'))
      console.log(chalk.gray('  Hover over any element, click it, type what you want.'))
      console.log(chalk.gray('  No FAB button, no quick actions — just direct editing.'))
    } else {
      console.log(chalk.bold('  How to use:'))
      console.log(chalk.cyan('  1.') + ' Start your dev server: ' + chalk.gray('npm run dev'))
      console.log(chalk.cyan('  2.') + ` Press ${chalk.bold('⌘D')} to enter Design Mode`)
      console.log(chalk.cyan('  3.') + ' Click any element and describe what you want')
    }

    console.log('')
    if (config.autoTrigger) {
      console.log(chalk.green('  Auto-trigger: ON') + chalk.gray(' — Claude Code will execute tasks automatically'))
    } else {
      console.log(chalk.yellow('  Auto-trigger: OFF') + chalk.gray(' — Tasks written to .vibe/tasks/DESIGN_TASK.md'))
    }
    console.log('')
    console.log(chalk.gray('  Press Ctrl+C to stop.'))
    console.log('')

    process.on('SIGINT', () => {
      console.log('')
      console.log(chalk.gray('  Shutting down...'))
      process.exit(0)
    })
  } catch (err) {
    serverSpinner.fail('Failed to start server')
    console.error(chalk.red(`  Error: ${(err as Error).message}`))
    process.exit(1)
  }
}
