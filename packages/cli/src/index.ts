import { Command } from 'commander'
import { resolve } from 'path'

const program = new Command()

program
  .name('vibe-design')
  .description('Click what\'s broken. Describe what you want. Claude fixes it.')
  .version('0.1.0')

program
  .command('setup [dir]')
  .description('One command — init + start (the fastest way to get going)')
  .option('-s, --simple', 'Simple mode — no FAB, click any element to edit directly')
  .action(async (dir, opts) => {
    const { setupCommand } = await import('./commands/setup.js')
    await setupCommand(resolve(dir || '.'), { simple: opts.simple })
  })

program
  .command('init')
  .description('Detect stack, generate .vibe/, inject adapter, write Claude Code skills')
  .option('-d, --dir <path>', 'Project directory', '.')
  .action(async (opts) => {
    const { initCommand } = await import('./commands/init.js')
    await initCommand(resolve(opts.dir))
  })

program
  .command('start')
  .description('Start local vibe server + overlay injection')
  .option('-d, --dir <path>', 'Project directory', '.')
  .option('-s, --simple', 'Simple mode — no FAB, click any element to edit directly')
  .action(async (opts) => {
    const { startCommand } = await import('./commands/start.js')
    await startCommand(resolve(opts.dir), { simple: opts.simple })
  })

program
  .command('sync')
  .description('Re-run detection and regenerate skills (after adding new dependencies)')
  .option('-d, --dir <path>', 'Project directory', '.')
  .action(async (opts) => {
    const { syncCommand } = await import('./commands/sync.js')
    await syncCommand(resolve(opts.dir))
  })

program
  .command('detect')
  .description('Print detected stack without making changes')
  .option('-d, --dir <path>', 'Project directory', '.')
  .action(async (opts) => {
    const { detectCommand } = await import('./commands/detect.js')
    await detectCommand(resolve(opts.dir))
  })

program
  .command('task <intent>')
  .description('Manually trigger a design task from CLI')
  .option('-d, --dir <path>', 'Project directory', '.')
  .option('-f, --file <path>', 'Target file path')
  .option('-l, --line <number>', 'Target line number', parseInt)
  .action(async (intent, opts) => {
    const { taskCommand } = await import('./commands/task.js')
    await taskCommand(resolve(opts.dir), {
      intent,
      file: opts.file,
      line: opts.line,
    })
  })

program
  .command('eject')
  .description('Remove overlay + adapter, keep skills as standalone Claude Code context')
  .option('-d, --dir <path>', 'Project directory', '.')
  .action(async (opts) => {
    const { ejectCommand } = await import('./commands/eject.js')
    await ejectCommand(resolve(opts.dir))
  })

program
  .command('design-system <action> [value]')
  .description('Manage design system rules (list, add, remove, init)')
  .option('-d, --dir <path>', 'Project directory', '.')
  .action(async (action, value, opts) => {
    const { designSystemCommand } = await import('./commands/design-system.js')
    await designSystemCommand(resolve(opts.dir), action, value)
  })

program.parse()
