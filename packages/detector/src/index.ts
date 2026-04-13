import { readFile, access, readdir } from 'fs/promises'
import { join, relative } from 'path'
import { glob } from 'glob'
import type { DetectedStack, DesignToken, ComponentPattern } from './types.js'

export type { DetectedStack, DesignToken, ComponentPattern } from './types.js'

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

function getVersion(deps: Record<string, string> | undefined, pkg: string): string {
  return deps?.[pkg]?.replace(/[\^~>=<]/g, '') ?? ''
}

async function detectFramework(
  projectDir: string,
  pkg: PackageJson
): Promise<Pick<DetectedStack, 'framework' | 'frameworkVersion' | 'router'>> {
  if (pkg.dependencies?.next) {
    const version = getVersion(pkg.dependencies, 'next')
    const hasAppDir =
      (await fileExists(join(projectDir, 'src/app'))) ||
      (await fileExists(join(projectDir, 'app')))
    const hasPagesDir =
      (await fileExists(join(projectDir, 'src/pages'))) ||
      (await fileExists(join(projectDir, 'pages')))
    return {
      framework: 'nextjs',
      frameworkVersion: version,
      router: hasAppDir ? 'app' : hasPagesDir ? 'pages' : 'app',
    }
  }

  // SvelteKit (check before Svelte since SvelteKit has svelte as a dependency)
  if (pkg.devDependencies?.['@sveltejs/kit'] || pkg.dependencies?.['@sveltejs/kit']) {
    return {
      framework: 'sveltekit',
      frameworkVersion: getVersion(pkg.devDependencies, '@sveltejs/kit') || getVersion(pkg.dependencies, '@sveltejs/kit'),
      router: 'file-based',
    }
  }

  // Svelte (without SvelteKit)
  if (pkg.devDependencies?.svelte || pkg.dependencies?.svelte) {
    return {
      framework: 'svelte',
      frameworkVersion: getVersion(pkg.devDependencies, 'svelte') || getVersion(pkg.dependencies, 'svelte'),
      router: null,
    }
  }

  // Nuxt (Vue meta-framework)
  if (pkg.dependencies?.nuxt || pkg.devDependencies?.nuxt) {
    return {
      framework: 'nuxt',
      frameworkVersion: getVersion(pkg.dependencies, 'nuxt') || getVersion(pkg.devDependencies, 'nuxt'),
      router: 'file-based',
    }
  }

  // Remix
  if (pkg.dependencies?.['@remix-run/react']) {
    return {
      framework: 'remix',
      frameworkVersion: getVersion(pkg.dependencies, '@remix-run/react'),
      router: 'file-based',
    }
  }

  // Vite + React (generic)
  if (pkg.dependencies?.vite || pkg.devDependencies?.vite) {
    const hasReact = !!pkg.dependencies?.react || !!pkg.devDependencies?.react
    const hasVue = !!pkg.dependencies?.vue || !!pkg.devDependencies?.vue
    return {
      framework: hasVue ? 'nuxt' : 'vite-react', // approximate, Vite+Vue without Nuxt
      frameworkVersion: getVersion(pkg.dependencies, 'vite') || getVersion(pkg.devDependencies, 'vite'),
      router: null,
    }
  }

  return { framework: 'unknown', frameworkVersion: '', router: null }
}

async function detectCSS(
  projectDir: string,
  pkg: PackageJson
): Promise<Pick<DetectedStack, 'css' | 'tailwindVersion' | 'tailwindConfig'>> {
  const hasTailwind =
    !!pkg.devDependencies?.tailwindcss ||
    !!pkg.dependencies?.tailwindcss ||
    (await fileExists(join(projectDir, 'tailwind.config.ts'))) ||
    (await fileExists(join(projectDir, 'tailwind.config.js')))

  if (hasTailwind) {
    const version =
      getVersion(pkg.devDependencies, 'tailwindcss') ||
      getVersion(pkg.dependencies, 'tailwindcss')

    const config = await parseTailwindConfig(projectDir)
    return { css: 'tailwind', tailwindVersion: version, tailwindConfig: config }
  }

  if (pkg.dependencies?.['styled-components'] || pkg.devDependencies?.['styled-components']) {
    return { css: 'styled-components' }
  }
  if (pkg.dependencies?.['@emotion/react'] || pkg.devDependencies?.['@emotion/react']) {
    return { css: 'emotion' }
  }

  return { css: 'vanilla' }
}

async function parseTailwindConfig(projectDir: string): Promise<Record<string, unknown>> {
  // Try dynamic import for JS configs first (most accurate)
  const jsConfigPaths = ['tailwind.config.js', 'tailwind.config.mjs']
  for (const configPath of jsConfigPaths) {
    const fullPath = join(projectDir, configPath)
    if (await fileExists(fullPath)) {
      try {
        const url = `file://${fullPath}`
        const mod = await import(url)
        const config = mod.default || mod
        return extractThemeFromObject(config)
      } catch {
        // Dynamic import failed, fall back to regex
      }
    }
  }

  // Fallback: regex parsing for TS configs and failed JS imports
  const configPaths = ['tailwind.config.ts', 'tailwind.config.js', 'tailwind.config.mjs']
  for (const configPath of configPaths) {
    const fullPath = join(projectDir, configPath)
    if (await fileExists(fullPath)) {
      try {
        const content = await readFile(fullPath, 'utf-8')
        return extractTailwindThemeFromText(content)
      } catch {
        // Fall through
      }
    }
  }
  return {}
}

function extractThemeFromObject(config: any): Record<string, unknown> {
  const theme: Record<string, unknown> = {}
  const extend = config?.theme?.extend || {}
  const base = config?.theme || {}

  // Colors: merge base and extend
  const colors = { ...(base.colors || {}), ...(extend.colors || {}) }
  if (Object.keys(colors).length > 0) {
    theme.colors = flattenNestedColors(colors)
  }

  // Spacing
  const spacing = { ...(base.spacing || {}), ...(extend.spacing || {}) }
  if (Object.keys(spacing).length > 0) {
    theme.spacing = flattenSimple(spacing)
  }

  // Font size
  const fontSize = { ...(base.fontSize || {}), ...(extend.fontSize || {}) }
  if (Object.keys(fontSize).length > 0) {
    theme.fontSize = flattenFontSize(fontSize)
  }

  // Border radius
  const borderRadius = { ...(base.borderRadius || {}), ...(extend.borderRadius || {}) }
  if (Object.keys(borderRadius).length > 0) {
    theme.borderRadius = flattenSimple(borderRadius)
  }

  // Box shadow
  const boxShadow = { ...(base.boxShadow || {}), ...(extend.boxShadow || {}) }
  if (Object.keys(boxShadow).length > 0) {
    theme.boxShadow = flattenSimple(boxShadow)
  }

  // Font family
  const fontFamily = { ...(base.fontFamily || {}), ...(extend.fontFamily || {}) }
  if (Object.keys(fontFamily).length > 0) {
    theme.fontFamily = flattenFontFamily(fontFamily)
  }

  return theme
}

function flattenNestedColors(obj: any, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}-${key}` : key
    if (typeof value === 'string') {
      result[fullKey] = value
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenNestedColors(value, fullKey))
    }
  }
  return result
}

function flattenSimple(obj: any): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = value
    }
  }
  return result
}

function flattenFontSize(obj: any): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = value
    } else if (Array.isArray(value)) {
      // [fontSize, { lineHeight, letterSpacing }] format
      result[key] = value[0]
    }
  }
  return result
}

function flattenFontFamily(obj: any): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = value
    } else if (Array.isArray(value)) {
      result[key] = value.join(', ')
    }
  }
  return result
}

function extractTailwindThemeFromText(configContent: string): Record<string, unknown> {
  const theme: Record<string, unknown> = {}

  // Use a balanced-braces approach for extracting nested objects
  const themeExtractors: Array<[string, string]> = [
    ['colors', 'colors'],
    ['spacing', 'spacing'],
    ['fontSize', 'fontSize'],
    ['borderRadius', 'borderRadius'],
    ['boxShadow', 'boxShadow'],
    ['fontFamily', 'fontFamily'],
  ]

  for (const [key, themeKey] of themeExtractors) {
    const block = extractBalancedBlock(configContent, key)
    if (block) {
      if (key === 'colors') {
        theme[themeKey] = parseNestedObject(block)
      } else {
        theme[themeKey] = parseSimpleObject(block)
      }
    }
  }

  return theme
}

/**
 * Extracts the content inside balanced braces after a key declaration.
 * Handles nested objects properly.
 */
function extractBalancedBlock(content: string, key: string): string | null {
  const regex = new RegExp(`${key}\\s*:\\s*\\{`)
  const match = regex.exec(content)
  if (!match) return null

  let depth = 0
  let start = match.index + match[0].length
  let i = start

  for (; i < content.length; i++) {
    if (content[i] === '{') depth++
    else if (content[i] === '}') {
      if (depth === 0) {
        return content.slice(start, i)
      }
      depth--
    }
  }
  return null
}

function parseSimpleObject(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const regex = /['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g
  let match
  while ((match = regex.exec(content)) !== null) {
    result[match[1]] = match[2]
  }
  return result
}

function parseNestedObject(
  content: string,
  prefix = ''
): Record<string, string> {
  const result: Record<string, string> = {}

  // Match simple key: 'value' pairs
  const simpleRegex = /['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g
  let match
  while ((match = simpleRegex.exec(content)) !== null) {
    const key = prefix ? `${prefix}-${match[1]}` : match[1]
    result[key] = match[2]
  }

  // Match nested objects: key: { ... }
  const nestedRegex = /['"]?([\w-]+)['"]?\s*:\s*\{([^{}]*)\}/g
  while ((match = nestedRegex.exec(content)) !== null) {
    const nestedPrefix = prefix ? `${prefix}-${match[1]}` : match[1]
    const nested = parseNestedObject(match[2], nestedPrefix)
    Object.assign(result, nested)
  }

  return result
}

async function detectComponents(
  projectDir: string,
  pkg: PackageJson
): Promise<DetectedStack['components']> {
  // Check for shadcn
  if (
    (await fileExists(join(projectDir, 'components.json'))) ||
    (await fileExists(join(projectDir, 'src/components/ui/button.tsx'))) ||
    (await fileExists(join(projectDir, 'components/ui/button.tsx')))
  ) {
    return 'shadcn'
  }

  if (pkg.dependencies?.['@radix-ui/react-slot']) return 'radix'
  if (pkg.dependencies?.['@mantine/core']) return 'mantine'
  if (pkg.dependencies?.['@chakra-ui/react']) return 'chakra'
  if (pkg.dependencies?.['@mui/material']) return 'mui'

  return 'custom'
}

async function detectDirectories(
  projectDir: string
): Promise<Pick<DetectedStack, 'srcDir' | 'appDir' | 'componentsDir'>> {
  const hasSrc = await fileExists(join(projectDir, 'src'))

  const srcDir = hasSrc ? 'src/' : './'
  const appDir = (await fileExists(join(projectDir, srcDir, 'app')))
    ? `${srcDir}app/`
    : `${srcDir}pages/`
  const componentsDir = (await fileExists(join(projectDir, srcDir, 'components')))
    ? `${srcDir}components/`
    : srcDir

  return { srcDir, appDir, componentsDir }
}

/**
 * Extracts CVA variant names and their possible values from a file.
 * Handles patterns like:
 *   cva("base classes", { variants: { variant: { default: "...", outline: "..." }, size: { sm: "...", lg: "..." } } })
 */
function extractCVAVariants(content: string): string[] | undefined {
  // Find the cva() call
  const cvaStart = content.indexOf('cva(')
  if (cvaStart === -1) return undefined

  // Find the variants block using balanced brace matching
  const variantsBlock = extractBalancedBlock(content.slice(cvaStart), 'variants')
  if (!variantsBlock) return undefined

  // Extract top-level keys from variants block (these are variant names)
  const variantNames: string[] = []

  // Match keys followed by : { (variant categories like "variant", "size")
  const keyRegex = /['"]?(\w+)['"]?\s*:\s*\{/g
  let match
  while ((match = keyRegex.exec(variantsBlock)) !== null) {
    const variantName = match[1]

    // Extract this variant's possible values
    const variantValuesBlock = extractBalancedBlock(variantsBlock.slice(match.index), variantName)
    if (variantValuesBlock) {
      const valueKeys: string[] = []
      const valueRegex = /['"]?([\w-]+)['"]?\s*:/g
      let valueMatch
      while ((valueMatch = valueRegex.exec(variantValuesBlock)) !== null) {
        valueKeys.push(valueMatch[1])
      }
      if (valueKeys.length > 0) {
        variantNames.push(`${variantName}: ${valueKeys.join(' | ')}`)
      } else {
        variantNames.push(variantName)
      }
    } else {
      variantNames.push(variantName)
    }
  }

  return variantNames.length > 0 ? variantNames : undefined
}

async function extractDesignTokens(
  tailwindConfig: Record<string, unknown>
): Promise<DesignToken[]> {
  const tokens: DesignToken[] = []
  const colors = tailwindConfig.colors as Record<string, string> | undefined

  if (colors) {
    for (const [name, value] of Object.entries(colors)) {
      tokens.push({
        name,
        value,
        category: 'color',
        nearestDefault: findNearestDefaultColor(value),
      })
    }
  }

  const spacing = tailwindConfig.spacing as Record<string, string> | undefined
  if (spacing) {
    for (const [name, value] of Object.entries(spacing)) {
      tokens.push({ name, value, category: 'spacing' })
    }
  }

  const fontSize = tailwindConfig.fontSize as Record<string, string> | undefined
  if (fontSize) {
    for (const [name, value] of Object.entries(fontSize)) {
      tokens.push({ name, value, category: 'fontSize' })
    }
  }

  const borderRadius = tailwindConfig.borderRadius as Record<string, string> | undefined
  if (borderRadius) {
    for (const [name, value] of Object.entries(borderRadius)) {
      tokens.push({ name, value, category: 'borderRadius' })
    }
  }

  const boxShadow = tailwindConfig.boxShadow as Record<string, string> | undefined
  if (boxShadow) {
    for (const [name, value] of Object.entries(boxShadow)) {
      tokens.push({ name, value, category: 'boxShadow' })
    }
  }

  const fontFamily = tailwindConfig.fontFamily as Record<string, string> | undefined
  if (fontFamily) {
    for (const [name, value] of Object.entries(fontFamily)) {
      tokens.push({ name, value, category: 'fontFamily' })
    }
  }

  return tokens
}

const DEFAULT_COLORS: Record<string, string> = {
  'slate-50': '#f8fafc', 'slate-500': '#64748b', 'slate-900': '#0f172a',
  'gray-50': '#f9fafb', 'gray-500': '#6b7280', 'gray-900': '#111827',
  'red-500': '#ef4444', 'red-600': '#dc2626',
  'orange-500': '#f97316',
  'yellow-500': '#eab308',
  'green-500': '#22c55e', 'green-600': '#16a34a',
  'blue-500': '#3b82f6', 'blue-600': '#2563eb', 'blue-700': '#1d4ed8',
  'indigo-500': '#6366f1', 'indigo-600': '#4f46e5',
  'violet-500': '#8b5cf6', 'violet-600': '#7c3aed',
  'purple-500': '#a855f7', 'purple-600': '#9333ea',
  'pink-500': '#ec4899',
  'white': '#ffffff', 'black': '#000000',
}

function hexToRgb(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : null
}

function colorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1)
  const rgb2 = hexToRgb(hex2)
  if (!rgb1 || !rgb2) return Infinity
  return Math.sqrt(
    (rgb1[0] - rgb2[0]) ** 2 + (rgb1[1] - rgb2[1]) ** 2 + (rgb1[2] - rgb2[2]) ** 2
  )
}

function findNearestDefaultColor(hex: string): string | undefined {
  if (!hex.startsWith('#')) return undefined
  let nearest = ''
  let minDist = Infinity
  for (const [name, value] of Object.entries(DEFAULT_COLORS)) {
    const dist = colorDistance(hex, value)
    if (dist < minDist) {
      minDist = dist
      nearest = name
    }
  }
  return minDist < 80 ? `≈ ${nearest}` : undefined
}

async function scanComponents(
  projectDir: string,
  srcDir: string,
  componentsDir: string
): Promise<ComponentPattern[]> {
  const patterns: ComponentPattern[] = []
  const srcPath = join(projectDir, srcDir)

  const componentFiles = await glob('**/*.{tsx,jsx,svelte,vue}', {
    cwd: srcPath,
    ignore: ['node_modules/**', '**/*.test.*', '**/*.spec.*', '**/*.stories.*'],
  })

  // Read all source files to count imports
  const allFiles = await glob('**/*.{tsx,jsx,ts,js}', {
    cwd: srcPath,
    ignore: ['node_modules/**'],
  })

  const fileContents = new Map<string, string>()
  for (const file of allFiles) {
    try {
      const content = await readFile(join(srcPath, file), 'utf-8')
      fileContents.set(file, content)
    } catch {
      // skip unreadable files
    }
  }

  for (const file of componentFiles) {
    const content = fileContents.get(file)
    if (!content) continue

    const isSvelte = file.endsWith('.svelte')
    const isVue = file.endsWith('.vue')

    let componentName: string | undefined
    let hasDefaultExport = false

    if (isSvelte) {
      // Svelte: component name is the file name (PascalCase)
      const match = file.match(/([^/\\]+)\.svelte$/)
      componentName = match?.[1]
      hasDefaultExport = true
    } else if (isVue) {
      // Vue: component name from <script> name option or file name
      const nameMatch = content.match(/name\s*:\s*['"](\w+)['"]/)
      const fileMatch = file.match(/([^/\\]+)\.vue$/)
      componentName = nameMatch?.[1] || fileMatch?.[1]
      hasDefaultExport = true
    } else {
      // React: check for exports
      hasDefaultExport = /export\s+default\s+function\s+(\w+)/.test(content) ||
        /export\s+default\s+\w+/.test(content)
      const namedExportMatch = content.match(/export\s+(?:function|const)\s+([A-Z]\w+)/)

      componentName = hasDefaultExport
        ? content.match(/export\s+default\s+function\s+(\w+)/)?.[1] ||
          content.match(/export\s+default\s+(\w+)/)?.[1]
        : namedExportMatch?.[1]
    }

    if (!componentName || !/^[A-Z]/.test(componentName)) continue

    // Detect styling pattern
    let stylingPattern: ComponentPattern['stylingPattern'] = 'unknown'
    if (/cva\s*\(/.test(content)) stylingPattern = 'cva'
    else if (/\bcn\s*\(/.test(content)) stylingPattern = 'cn'
    else if (/className/.test(content) || /class:/.test(content) || /class=/.test(content)) stylingPattern = 'className'
    else if (/styled\.\w+/.test(content) || /styled\(/.test(content)) stylingPattern = 'styled'

    // Count usages across all files
    let usageCount = 0
    for (const [otherFile, otherContent] of fileContents) {
      if (otherFile === file) continue
      const importRegex = new RegExp(
        `import\\s+.*\\b${componentName}\\b.*from\\s+['"]`,
        's'
      )
      if (importRegex.test(otherContent)) usageCount++

      // Svelte: also check for <ComponentName usage
      if (isSvelte || isVue) {
        const tagRegex = new RegExp(`<${componentName}[\\s/>]`)
        if (tagRegex.test(otherContent)) usageCount++
      }
    }

    // Check if it's in the components directory (shared)
    const isShared = file.startsWith(relative(srcDir, componentsDir).replace(/\\/g, '/')) ||
      file.includes('components/')

    // Extract CVA variants with balanced-brace parsing
    let variants: string[] | undefined
    if (stylingPattern === 'cva') {
      variants = extractCVAVariants(content)
    }

    patterns.push({
      name: componentName,
      filePath: `${srcDir}${file}`,
      exportType: hasDefaultExport ? 'default' : 'named',
      stylingPattern,
      usageCount,
      isShared,
      variants,
    })
  }

  // Sort by usage count descending
  patterns.sort((a, b) => b.usageCount - a.usageCount)
  return patterns
}

export async function detectStack(projectDir: string): Promise<DetectedStack> {
  const pkg = (await readJson<PackageJson>(join(projectDir, 'package.json'))) ?? {}

  const [frameworkInfo, cssInfo, components, dirs] = await Promise.all([
    detectFramework(projectDir, pkg),
    detectCSS(projectDir, pkg),
    detectComponents(projectDir, pkg),
    detectDirectories(projectDir),
  ])

  const typescript = await fileExists(join(projectDir, 'tsconfig.json'))

  const designTokens = cssInfo.tailwindConfig
    ? await extractDesignTokens(cssInfo.tailwindConfig)
    : []

  const componentPatterns = await scanComponents(
    projectDir,
    dirs.srcDir,
    dirs.componentsDir
  )

  // Also try to extract CSS custom properties from globals
  const cssTokens = await extractCSSCustomProperties(projectDir, dirs.srcDir)
  designTokens.push(...cssTokens)

  return {
    ...frameworkInfo,
    ...cssInfo,
    components,
    typescript,
    ...dirs,
    designTokens,
    componentPatterns,
  }
}

async function extractCSSCustomProperties(
  projectDir: string,
  srcDir: string
): Promise<DesignToken[]> {
  const tokens: DesignToken[] = []
  const cssFiles = ['globals.css', 'app.css', 'global.css', 'index.css']

  for (const cssFile of cssFiles) {
    for (const dir of [srcDir, `${srcDir}app/`, `${srcDir}styles/`, '']) {
      const fullPath = join(projectDir, dir, cssFile)
      if (await fileExists(fullPath)) {
        try {
          const content = await readFile(fullPath, 'utf-8')
          const varRegex = /--([a-zA-Z][\w-]*)\s*:\s*([^;]+);/g
          let match
          while ((match = varRegex.exec(content)) !== null) {
            const value = match[2].trim()
            // Determine category from name or value
            let category: DesignToken['category'] = 'color'
            if (match[1].includes('radius')) category = 'borderRadius'
            else if (match[1].includes('spacing') || match[1].includes('gap')) category = 'spacing'
            else if (match[1].includes('font-size') || match[1].includes('text')) category = 'fontSize'
            else if (match[1].includes('shadow')) category = 'boxShadow'

            tokens.push({
              name: `--${match[1]}`,
              value,
              category,
            })
          }
        } catch {
          // skip
        }
      }
    }
  }
  return tokens
}
