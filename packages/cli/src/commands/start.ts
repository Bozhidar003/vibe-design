import chalk from 'chalk'
import ora from 'ora'
import { access } from 'fs/promises'
import { join } from 'path'

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function startCommand(projectDir: string): Promise<void> {
  console.log('')
  console.log(chalk.bold('  🎨 Vibe Design — Start'))
  console.log('')

  // Check if initialized
  const configPath = join(projectDir, '.vibe', 'config.json')
  if (!(await fileExists(configPath))) {
    console.log(chalk.red('  Error: Project not initialized.'))
    console.log(chalk.gray('  Run: npx vibe-design init'))
    process.exit(1)
  }

  // Start the server
  const serverSpinner = ora('Starting vibe server...').start()

  try {
    const { createVibeServer } = await import('@vibe-design/server')
    const { config } = await createVibeServer(projectDir)

    serverSpinner.succeed(`Vibe server running on http://localhost:${config.port}`)

    console.log('')
    console.log(chalk.gray('  Endpoints:'))
    console.log(chalk.gray(`    Health:    http://localhost:${config.port}/health`))
    console.log(chalk.gray(`    Overlay:   http://localhost:${config.port}/overlay.js`))
    console.log(chalk.gray(`    Tasks:     POST http://localhost:${config.port}/task`))
    console.log(chalk.gray(`    WebSocket: ws://localhost:${config.port}/ws`))
    console.log('')
    console.log(chalk.bold('  How to use:'))
    console.log('')
    console.log(chalk.cyan('  1.') + ' Start your dev server (if not already running):')
    console.log(chalk.gray('     npm run dev'))
    console.log('')
    console.log(chalk.cyan('  2.') + ` Open your app and press ${chalk.bold('⌘D')} to enter Design Mode`)
    console.log('')
    console.log(chalk.cyan('  3.') + ' Click any element and describe what you want')
    console.log('')

    if (config.autoTrigger) {
      console.log(chalk.green('  Auto-trigger: ON') + chalk.gray(' — Claude Code will execute tasks automatically'))
    } else {
      console.log(chalk.yellow('  Auto-trigger: OFF') + chalk.gray(` — Tasks written to .vibe/tasks/DESIGN_TASK.md`))
      console.log(chalk.gray('  Tip: Set "autoTrigger": true in .vibe/config.json to auto-execute'))
    }
    console.log('')
    console.log(chalk.gray('  Press Ctrl+C to stop the server.'))
    console.log('')

    // Keep process alive
    process.on('SIGINT', () => {
      console.log('')
      console.log(chalk.gray('  Shutting down vibe server...'))
      process.exit(0)
    })
  } catch (err) {
    serverSpinner.fail('Failed to start server')
    console.error(chalk.red(`  Error: ${(err as Error).message}`))
    process.exit(1)
  }
}
