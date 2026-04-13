import { resolve } from 'path'
import chalk from 'chalk'
import { initCommand } from './init.js'
import { startCommand } from './start.js'

export async function setupCommand(
  projectDir: string,
  options: { simple?: boolean } = {}
): Promise<void> {
  console.log('')
  console.log(chalk.bold('  Vibe Design — Setup'))
  console.log(chalk.gray(`  Project: ${projectDir}`))
  console.log('')

  // Step 1: Init
  await initCommand(projectDir)

  // Step 2: Print instructions
  console.log('')
  console.log(chalk.bold('  Start your dev server in another terminal:'))
  console.log(chalk.cyan(`    cd ${projectDir} && npm run dev`))
  console.log('')
  console.log(chalk.gray('  Starting vibe server...'))
  console.log('')

  // Step 3: Start server (blocks)
  await startCommand(projectDir, { simple: options.simple })
}
