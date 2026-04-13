import chalk from 'chalk'
import ora from 'ora'
import { detectStack } from '@vibe-design/detector'

export async function detectCommand(projectDir: string): Promise<void> {
  console.log('')
  console.log(chalk.bold('  🎨 Vibe Design — Detect'))
  console.log('')

  const spinner = ora('Scanning project...').start()

  try {
    const stack = await detectStack(projectDir)
    spinner.succeed('Detection complete')

    console.log('')
    console.log(chalk.bold('  Stack:'))
    console.log(`    Framework:    ${stack.framework}${stack.frameworkVersion ? ' v' + stack.frameworkVersion : ''}`)
    console.log(`    Router:       ${stack.router || 'N/A'}`)
    console.log(`    CSS:          ${stack.css}${stack.tailwindVersion ? ' v' + stack.tailwindVersion : ''}`)
    console.log(`    Components:   ${stack.components}`)
    console.log(`    TypeScript:   ${stack.typescript ? 'yes' : 'no'}`)
    console.log('')

    console.log(chalk.bold('  Directories:'))
    console.log(`    Source:       ${stack.srcDir}`)
    console.log(`    App:          ${stack.appDir}`)
    console.log(`    Components:   ${stack.componentsDir}`)
    console.log('')

    if (stack.designTokens.length > 0) {
      console.log(chalk.bold(`  Design Tokens (${stack.designTokens.length}):`))
      for (const token of stack.designTokens.slice(0, 10)) {
        const ref = token.nearestDefault ? chalk.gray(` (${token.nearestDefault})`) : ''
        console.log(`    ${token.name}: ${token.value}${ref}`)
      }
      if (stack.designTokens.length > 10) {
        console.log(chalk.gray(`    ... and ${stack.designTokens.length - 10} more`))
      }
      console.log('')
    }

    if (stack.componentPatterns.length > 0) {
      console.log(chalk.bold(`  Components (${stack.componentPatterns.length}):`))
      for (const comp of stack.componentPatterns.slice(0, 10)) {
        console.log(`    ${comp.name} — ${comp.filePath} (${comp.usageCount} usages, ${comp.stylingPattern})`)
      }
      if (stack.componentPatterns.length > 10) {
        console.log(chalk.gray(`    ... and ${stack.componentPatterns.length - 10} more`))
      }
      console.log('')
    }

    console.log(chalk.gray('  No files were modified. Run `npx vibe-design init` to generate config.'))
    console.log('')
  } catch (err) {
    spinner.fail('Detection failed')
    console.error(chalk.red(`  Error: ${(err as Error).message}`))
    process.exit(1)
  }
}
