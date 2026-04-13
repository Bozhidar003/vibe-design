import type { NextConfig } from 'next'

interface VibeDesignOptions {
  port?: number
}

/**
 * Next.js config wrapper that injects the Vibe Design overlay
 * in development mode.
 *
 * Usage in next.config.js:
 *   const { withVibeDesign } = require('@vibe-design/adapter-nextjs')
 *   module.exports = withVibeDesign({ ...yourConfig })
 */
export function withVibeDesign(
  nextConfig: NextConfig = {},
  options: VibeDesignOptions = {}
): NextConfig {
  // Only activate in development
  if (process.env.NODE_ENV !== 'development') return nextConfig

  const port = options.port ?? 2337

  return {
    ...nextConfig,

    async rewrites() {
      const existing = (await nextConfig.rewrites?.()) ?? []

      const vibeRewrites = [
        {
          source: '/__vibe/:path*',
          destination: `http://localhost:${port}/:path*`,
        },
      ]

      // Handle both array and object rewrite formats
      if (Array.isArray(existing)) {
        return [...existing, ...vibeRewrites]
      }

      return {
        ...existing,
        fallback: [...(existing.fallback ?? []), ...vibeRewrites],
      }
    },

    webpack(config: any, context: any) {
      if (context.dev && !context.isServer) {
        // Inject overlay script into client bundle entry
        const originalEntry = config.entry
        config.entry = async () => {
          const entries = await (typeof originalEntry === 'function'
            ? originalEntry()
            : originalEntry)

          // Add overlay script loader
          const overlayLoader = `
            (function() {
              if (typeof window !== 'undefined' && !window.__vibeDesignLoaded) {
                window.__vibeDesignLoaded = true;
                var script = document.createElement('script');
                script.src = '/__vibe/overlay.js';
                script.async = true;
                script.onerror = function() {
                  console.warn('[vibe-design] Could not load overlay. Is the vibe server running? (npx vibe-design start)');
                };
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', function() {
                    document.body.appendChild(script);
                  });
                } else {
                  document.body.appendChild(script);
                }
              }
            })();
          `

          // Inject as a virtual module
          if (entries['main-app']) {
            if (Array.isArray(entries['main-app'])) {
              entries['main-app'].unshift(
                `data:text/javascript;base64,${Buffer.from(overlayLoader).toString('base64')}`
              )
            }
          } else if (entries.main) {
            if (Array.isArray(entries.main)) {
              entries.main.unshift(
                `data:text/javascript;base64,${Buffer.from(overlayLoader).toString('base64')}`
              )
            }
          }

          return entries
        }
      }

      // Call original webpack config if it exists
      return nextConfig.webpack?.(config, context) ?? config
    },
  }
}

export default withVibeDesign
