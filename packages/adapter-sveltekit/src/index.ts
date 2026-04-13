import type { Plugin, ViteDevServer } from 'vite'

interface VibeDesignSvelteKitOptions {
  port?: number
}

/**
 * SvelteKit adapter for Vibe Design.
 *
 * SvelteKit uses Vite, so this is a Vite plugin that:
 * 1. Proxies /__vibe/* to the vibe server
 * 2. Injects the overlay script into SvelteKit's HTML responses
 * 3. Works with SvelteKit's handle hook for server-rendered pages
 *
 * Usage in vite.config.ts:
 *   import { sveltekit } from '@sveltejs/kit/vite'
 *   import { vibeDesignSvelteKit } from '@vibe-design/adapter-sveltekit'
 *
 *   export default defineConfig({
 *     plugins: [sveltekit(), vibeDesignSvelteKit()],
 *   })
 */
export function vibeDesignSvelteKit(options: VibeDesignSvelteKitOptions = {}): Plugin {
  const port = options.port ?? 2337

  return {
    name: 'vibe-design-sveltekit',
    apply: 'serve',

    configureServer(server: ViteDevServer) {
      // Proxy /__vibe/* to the vibe server
      server.middlewares.use('/__vibe', (req, res) => {
        const targetUrl = `http://localhost:${port}${req.url}`
        const http = require('http')

        if (req.headers.upgrade === 'websocket') return

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
          res.end('Vibe Design server not running. Start it with: npx vibe-design start')
        })

        req.pipe(proxyReq)
      })
    },

    transformIndexHtml: {
      order: 'post',
      handler() {
        return [
          {
            tag: 'script',
            attrs: { src: '/__vibe/overlay.js', async: true },
            injectTo: 'body',
          },
        ]
      },
    },

    // For SvelteKit, we also need to handle SSR-rendered pages
    // This hook transforms the HTML after SvelteKit renders it
    transform(code: string, id: string) {
      // Inject into SvelteKit's app.html template if found
      if (id.endsWith('src/app.html') && !code.includes('__vibe/overlay.js')) {
        return code.replace(
          '</body>',
          `<script src="/__vibe/overlay.js" async></script>\n</body>`
        )
      }
      return undefined
    },
  }
}

/**
 * SvelteKit handle hook for server-side injection.
 * Add to src/hooks.server.ts:
 *
 *   import { vibeDesignHandle } from '@vibe-design/adapter-sveltekit'
 *   export const handle = vibeDesignHandle()
 *
 * Or combine with existing handles:
 *   import { sequence } from '@sveltejs/kit/hooks'
 *   export const handle = sequence(vibeDesignHandle(), yourHandle)
 */
export function vibeDesignHandle(options: VibeDesignSvelteKitOptions = {}) {
  const port = options.port ?? 2337

  return async ({ event, resolve }: any) => {
    // Only inject in dev mode
    if (process.env.NODE_ENV !== 'development' && !(import.meta as any).env?.DEV) {
      return resolve(event)
    }

    const response = await resolve(event, {
      transformPageChunk: ({ html }: { html: string }) => {
        if (html.includes('</body>') && !html.includes('__vibe/overlay.js')) {
          return html.replace(
            '</body>',
            `<script src="http://localhost:${port}/overlay.js" async></script>\n</body>`
          )
        }
        return html
      },
    })

    return response
  }
}

export default vibeDesignSvelteKit
