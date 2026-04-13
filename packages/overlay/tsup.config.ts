import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { overlay: 'src/overlay.ts' },
  format: ['iife'],
  target: 'es2022',
  clean: true,
  minify: false,
  globalName: 'VibeDesign',
  outDir: 'dist',
})
