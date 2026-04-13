import { readFile } from 'fs/promises'
import { join } from 'path'

export interface VibeConfig {
  port: number
  autoTrigger: boolean
  screenshotDefault: boolean
  screenshotScale: number
  claudeCommand: string
  excludeComponents: string[]
  customSkills: string[]
  overlay: {
    activationKey: string
    position: string
  }
  detection: {
    srcDir: string
    componentsDir: string
    appDir: string
  }
}

const DEFAULT_CONFIG: VibeConfig = {
  port: 2337,
  autoTrigger: false,
  screenshotDefault: false,
  screenshotScale: 2,
  claudeCommand: 'claude',
  excludeComponents: [],
  customSkills: [],
  overlay: {
    activationKey: 'd',
    position: 'bottom-right',
  },
  detection: {
    srcDir: 'src/',
    componentsDir: 'src/components/',
    appDir: 'src/app/',
  },
}

export async function loadConfig(projectDir: string): Promise<VibeConfig> {
  try {
    const configPath = join(projectDir, '.vibe', 'config.json')
    const content = await readFile(configPath, 'utf-8')
    const parsed = JSON.parse(content)
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return DEFAULT_CONFIG
  }
}
