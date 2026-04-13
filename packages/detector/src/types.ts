export interface DesignToken {
  name: string
  value: string
  category: 'color' | 'spacing' | 'fontSize' | 'borderRadius' | 'boxShadow' | 'fontFamily'
  nearestDefault?: string
}

export interface ComponentPattern {
  name: string
  filePath: string
  exportType: 'default' | 'named'
  stylingPattern: 'cva' | 'cn' | 'className' | 'styled' | 'unknown'
  usageCount: number
  isShared: boolean
  variants?: string[]
}

export interface DetectedStack {
  framework: 'nextjs' | 'vite-react' | 'nuxt' | 'remix' | 'sveltekit' | 'svelte' | 'unknown'
  frameworkVersion: string
  router: 'app' | 'pages' | 'file-based' | null

  css: 'tailwind' | 'cssmodules' | 'styled-components' | 'emotion' | 'vanilla'
  tailwindVersion?: string
  tailwindConfig?: Record<string, unknown>

  components: 'shadcn' | 'radix' | 'mantine' | 'chakra' | 'mui' | 'custom'

  typescript: boolean

  srcDir: string
  appDir: string
  componentsDir: string

  designTokens: DesignToken[]
  componentPatterns: ComponentPattern[]
}
