import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  noExternal: [
    '@bozhidar003/vibe-design-detector',
    '@bozhidar003/vibe-design-skill-generator',
    '@bozhidar003/vibe-design-server',
  ],
})
