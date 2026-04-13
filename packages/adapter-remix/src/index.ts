import type { Plugin } from 'vite'

interface VibeDesignRemixOptions {
  port?: number
}

/**
 * Remix adapter for Vibe Design.
 *
 * Remix v2+ uses Vite under the hood, so this is a Vite plugin that:
 * 1. Proxies /__vibe/* to the vibe server
 * 2. Injects the overlay script via Remix's HTML transform
 *
 * For Remix v2 (Vite-based), add to vite.config.ts:
 *   import { vibeDesignRemix } from '@vibe-design/adapter-remix'
 *   export default defineConfig({
 *     plugins: [remix(), vibeDesignRemix()],
 *   })
 *
 * For Remix v1 (non-Vite), add to entry.client.tsx:
 *   import '@vibe-design/adapter-remix/client'
 */
export function vibeDesignRemix(options: VibeDesignRemixOptions = {}): Plugin {
  const port = options.port ?? 2337

  return {
    name: 'vibe-design-remix',
    apply: 'serve',

    configureServer(server) {
      // Proxy /__vibe/* to vibe server
      server.middlewares.use('/__vibe', (req, res) => {
        const targetUrl = `http://localhost:${port}${req.url}`
        const http = require('http')

        const proxyReq = http.request(
          targetUrl,
          {
            method: req.method,
            headers: { ...req.headers, host: `localhost:${port}` },
          },
          (proxyRes: any) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers)
            proxyRes.pipe(res)
          }
        )

        proxyReq.on('error', () => {
          res.writeHead(502)
          res.end('Vibe Design server not running')
        })

        req.pipe(proxyReq)
      })
    },

    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { src: '/__vibe/overlay.js', async: true },
          injectTo: 'body',
        },
      ]
    },
  }
}

/**
 * Client-side loader for Remix v1 (non-Vite).
 * Import in entry.client.tsx:
 *   import '@vibe-design/adapter-remix/client'
 */
export function injectVibeOverlay(port = 2337): void {
  if (typeof window === 'undefined') return
  if (process.env.NODE_ENV !== 'development') return
  if ((window as any).__vibeDesignLoaded) return
  ;(window as any).__vibeDesignLoaded = true

  const script = document.createElement('script')
  script.src = `http://localhost:${port}/overlay.js`
  script.async = true
  script.onerror = () => {
    console.warn('[vibe-design] Could not load overlay. Is the vibe server running?')
  }
  document.body.appendChild(script)
}

export default vibeDesignRemix
