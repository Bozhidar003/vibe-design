import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import { glob } from 'glob'

const exec = promisify(execCallback)

// Common Tailwind classes that are too generic for file matching
const COMMON_CLASSES = new Set([
  'flex', 'block', 'inline', 'hidden', 'relative', 'absolute', 'fixed',
  'w-full', 'h-full', 'w-auto', 'h-auto',
  'p-0', 'p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-8',
  'm-0', 'm-1', 'm-2', 'm-3', 'm-4', 'm-auto',
  'px-2', 'px-3', 'px-4', 'py-1', 'py-2', 'py-3',
  'gap-1', 'gap-2', 'gap-3', 'gap-4',
  'text-sm', 'text-base', 'text-lg', 'text-xl',
  'font-bold', 'font-semibold', 'font-medium',
  'rounded', 'rounded-md', 'rounded-lg', 'rounded-full',
  'border', 'shadow', 'overflow-hidden',
  'items-center', 'justify-center', 'justify-between',
  'flex-col', 'flex-row', 'flex-1',
  'space-x-2', 'space-x-4', 'space-y-2', 'space-y-4',
  'bg-white', 'bg-black', 'text-white', 'text-black',
  'cursor-pointer', 'transition', 'duration-200',
])

export async function resolveFileFromHints(
  srcDir: string,
  hints: {
    componentName?: string | null
    classNameHint?: string | null
    textContentHint?: string | null
  }
): Promise<{ filePath: string; lineNumber: number } | null> {
  const { componentName, classNameHint } = hints

  // Try component name first
  if (componentName) {
    const files = await glob(`${srcDir}/**/${componentName}.{tsx,jsx,ts,js}`)
    if (files.length === 1) {
      return { filePath: files[0], lineNumber: 1 }
    }

    // Also try PascalCase file search
    if (files.length === 0) {
      const altFiles = await glob(`${srcDir}/**/*.{tsx,jsx}`)
      for (const file of altFiles) {
        try {
          const { stdout } = await exec(
            `grep -n "export.*${componentName}" "${file}"`,
            { timeout: 5000 }
          )
          if (stdout.trim()) {
            const lineMatch = stdout.match(/^(\d+):/)
            return {
              filePath: file,
              lineNumber: lineMatch ? parseInt(lineMatch[1]) : 1,
            }
          }
        } catch {
          // grep returns non-zero if no match, that's fine
        }
      }
    }
  }

  // Fall back to className grep
  if (classNameHint) {
    const specificClasses = classNameHint
      .split(' ')
      .filter((c) => c.length > 5 && !COMMON_CLASSES.has(c))
      .slice(0, 3)

    if (specificClasses.length > 0) {
      const grepPattern = specificClasses.join('.*')
      try {
        const { stdout } = await exec(
          `grep -rn "${grepPattern}" ${srcDir} --include="*.tsx" --include="*.jsx" -l`,
          { timeout: 10000 }
        )
        const files = stdout.trim().split('\n').filter(Boolean)
        if (files.length >= 1) {
          return { filePath: files[0], lineNumber: 1 }
        }
      } catch {
        // grep returned no matches
      }
    }
  }

  return null
}
