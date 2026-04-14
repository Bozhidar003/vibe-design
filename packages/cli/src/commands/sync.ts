import { access } from 'fs/promises'
import { join } from 'path'
import chalk from 'chalk'
import ora from 'ora'
import { detectStack, type DetectedStack } from '@bozhidar003/vibe-design-detector'
import { generateSkills, generateVibeConfig } from '@bozhidar003/vibe-design-skill-generator'
import { writeFile } from 'fs/promises'

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function syncCommand(projectDir: string): Promise<void> {
  console.log('')
  console.log(chalk.bold('  🎨 Vibe Design — Sync'))
  console.log(chalk.gray('  Re-running detection and regenerating skills...'))
  console.log('')

  // Check if initialized
  const vibeDir = join(projectDir, '.vibe')
  if (!(await fileExists(join(vibeDir, 'config.json')))) {
    console.log(chalk.red('  Error: Project not initialized.'))
    console.log(chalk.gray('  Run: npx vibe-design init'))
    process.exit(1)
  }

  // Step 1: Re-detect stack
  const detectSpinner = ora('Re-detecting project stack...').start()
  let stack: DetectedStack

  try {
    stack = await detectStack(projectDir)
    detectSpinner.succeed('Stack re-detected')
  } catch (err) {
    detectSpinner.fail('Failed to detect stack')
    console.error(chalk.red(`  Error: ${(err as Error).message}`))
    process.exit(1)
  }

  // Print detection summary
  console.log('')
  console.log(chalk.gray('  Framework:   ') + formatFramework(stack))
  console.log(chalk.gray('  CSS:         ') + formatCSS(stack))
  console.log(chalk.gray('  Components:  ') + stack.components)
  console.log(chalk.gray('  Scanned:     ') + `${stack.componentPatterns.length} components, ${stack.designTokens.length} tokens`)
  console.log('')

  // Step 2: Regenerate config
  const configSpinner = ora('Regenerating .vibe/config.json...').start()
  try {
    const configContent = generateVibeConfig(stack)
    await writeFile(join(vibeDir, 'config.json'), configContent)
    configSpinner.succeed('Updated .vibe/config.json')
  } catch (err) {
    configSpinner.fail('Failed to update config')
    console.error(chalk.red(`  Error: ${(err as Error).message}`))
  }

  // Step 3: Regenerate skills
  const skillsSpinner = ora('Regenerating .vibe/skills/...').start()
  try {
    await generateSkills(projectDir, stack)
    skillsSpinner.succeed('Updated .vibe/skills/')
  } catch (err) {
    skillsSpinner.fail('Failed to update skills')
    console.error(chalk.red(`  Error: ${(err as Error).message}`))
  }

  console.log('')
  console.log(chalk.green.bold('  ✓ Sync complete!'))
  console.log(chalk.gray('  Skills regenerated with latest project state.'))
  console.log('')
}

function formatFramework(stack: DetectedStack): string {
  if (stack.framework === 'nextjs') {
    return `Next.js${stack.frameworkVersion ? ' v' + stack.frameworkVersion : ''} (${stack.router} router)`
  }
  return stack.framework
}

function formatCSS(stack: DetectedStack): string {
  if (stack.css === 'tailwind') {
    return `Tailwind${stack.tailwindVersion ? ' v' + stack.tailwindVersion : ''}`
  }
  return stack.css
}
