import type { Plugin, ViteDevServer } from 'vite'

interface VibeDesignOptions {
  port?: number
}

/**
 * Vite plugin that injects the Vibe Design overlay in development mode.
 *
 * Usage in vite.config.ts:
 *   import { vibeDesign } from '@bozhidar003/vibe-design-adapter-vite'
 *   export default defineConfig({
 *     plugins: [react(), vibeDesign()],
 *   })
 */
export function vibeDesign(options: VibeDesignOptions = {}): Plugin {
  const port = options.port ?? 2337

  return {
    name: 'vibe-design',
    apply: 'serve', // Only active in dev mode

    configureServer(server: ViteDevServer) {
      // Proxy /__vibe/* requests to the vibe server
      server.middlewares.use('/__vibe', (req, res) => {
        const targetUrl = `http://localhost:${port}${req.url}`

        // Handle WebSocket upgrade separately (done via configureServer.ws)
        if (req.headers.upgrade === 'websocket') {
          return
        }

        // Proxy HTTP requests
        const http = require('http')
        const proxyReq = http.request(
          targetUrl,
          {
            method: req.method,
            headers: {
              ...req.headers,
              host: `localhost:${port}`,
            },
          },
          (proxyRes: any) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers)
            proxyRes.pipe(res)
          }
        )

        proxyReq.on('error', () => {
          res.writeHead(502)
          res.end('Vibe Design server not running. Start it with: npx vibe-design start')
        })

        req.pipe(proxyReq)
      })
    },

    transformIndexHtml() {
      // Inject the overlay script into the HTML
      return [
        {
          tag: 'script',
          attrs: {
            src: `/__vibe/overlay.js`,
            async: true,
          },
          injectTo: 'body',
        },
      ]
    },
  }
}

export default vibeDesign
