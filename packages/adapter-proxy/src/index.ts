import http from 'http'
import httpProxy from 'http-proxy'
import { URL } from 'url'

interface ProxyOptions {
  /** The upstream dev server to proxy (e.g., http://localhost:3000) */
  target: string
  /** Port for the proxy server to listen on (default: 4337) */
  proxyPort?: number
  /** Port where the vibe server runs (default: 2337) */
  vibePort?: number
}

const INJECT_SCRIPT = (vibePort: number) => `
<script>
  if (!window.__vibeDesignLoaded) {
    window.__vibeDesignLoaded = true;
    var s = document.createElement('script');
    s.src = 'http://localhost:${vibePort}/overlay.js';
    s.async = true;
    s.onerror = function() {
      console.warn('[vibe-design] Could not load overlay. Is the vibe server running?');
    };
    document.body.appendChild(s);
  }
</script>
`

/**
 * Creates a framework-agnostic HTTP proxy that:
 * 1. Proxies all requests to the upstream dev server
 * 2. Intercepts HTML responses and injects the overlay script
 * 3. Proxies /__vibe/* requests to the vibe server
 *
 * Usage:
 *   npx vibe-proxy --target http://localhost:3000
 *   # Then open http://localhost:4337 instead of :3000
 */
export function createVibeProxy(options: ProxyOptions) {
  const { target, proxyPort = 4337, vibePort = 2337 } = options

  const proxy = httpProxy.createProxyServer({
    target,
    selfHandleResponse: true,
    ws: true,
  })

  const vibeProxy = httpProxy.createProxyServer({
    target: `http://localhost:${vibePort}`,
  })

  // Handle proxy responses — inject script into HTML
  proxy.on('proxyRes', (proxyRes, req, res) => {
    const contentType = proxyRes.headers['content-type'] || ''
    const isHtml = contentType.includes('text/html')

    if (!isHtml) {
      // Pass through non-HTML responses unchanged
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers)
      proxyRes.pipe(res)
      return
    }

    // Collect the HTML body and inject our script
    const chunks: Buffer[] = []
    proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk))
    proxyRes.on('end', () => {
      let body = Buffer.concat(chunks).toString('utf-8')

      // Inject overlay script before </body>
      const scriptTag = INJECT_SCRIPT(vibePort)
      if (body.includes('</body>')) {
        body = body.replace('</body>', `${scriptTag}</body>`)
      } else {
        body += scriptTag
      }

      // Update content-length and remove content-encoding (we've decompressed)
      const headers = { ...proxyRes.headers }
      delete headers['content-encoding']
      delete headers['content-length']
      headers['content-length'] = String(Buffer.byteLength(body))

      res.writeHead(proxyRes.statusCode || 200, headers)
      res.end(body)
    })
  })

  proxy.on('error', (err, _req, res) => {
    console.error('[vibe-proxy] Upstream error:', err.message)
    if (res && 'writeHead' in res) {
      ;(res as http.ServerResponse).writeHead(502)
      ;(res as http.ServerResponse).end(`Upstream server error: ${err.message}`)
    }
  })

  vibeProxy.on('error', (err, _req, res) => {
    console.error('[vibe-proxy] Vibe server error:', err.message)
    if (res && 'writeHead' in res) {
      ;(res as http.ServerResponse).writeHead(502)
      ;(res as http.ServerResponse).end('Vibe Design server not running. Start it with: npx vibe-design start')
    }
  })

  const server = http.createServer((req, res) => {
    const url = req.url || '/'

    // Route /__vibe/* to the vibe server
    if (url.startsWith('/__vibe/')) {
      req.url = url.replace('/__vibe', '')
      vibeProxy.web(req, res)
      return
    }

    // Everything else goes to the upstream dev server
    proxy.web(req, res)
  })

  // WebSocket support — proxy both upstream WS and vibe WS
  server.on('upgrade', (req, socket, head) => {
    const url = req.url || '/'

    if (url.startsWith('/__vibe/')) {
      req.url = url.replace('/__vibe', '')
      vibeProxy.ws(req, socket, head)
    } else {
      proxy.ws(req, socket, head)
    }
  })

  server.listen(proxyPort, () => {
    console.log(`[vibe-proxy] Proxy running on http://localhost:${proxyPort}`)
    console.log(`[vibe-proxy] Upstream: ${target}`)
    console.log(`[vibe-proxy] Vibe server: http://localhost:${vibePort}`)
    console.log('')
    console.log(`Open http://localhost:${proxyPort} in your browser (not ${target})`)
  })

  return server
}

// CLI entry point
if (process.argv[1]?.includes('vibe-proxy') || process.argv[1]?.includes('adapter-proxy')) {
  const args = process.argv.slice(2)
  let target = 'http://localhost:3000'
  let proxyPort = 4337
  let vibePort = 2337

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) target = args[++i]
    else if (args[i] === '--port' && args[i + 1]) proxyPort = parseInt(args[++i])
    else if (args[i] === '--vibe-port' && args[i + 1]) vibePort = parseInt(args[++i])
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
  vibe-proxy — Framework-agnostic Vibe Design proxy

  Usage:
    vibe-proxy --target http://localhost:3000

  Options:
    --target <url>      Upstream dev server URL (default: http://localhost:3000)
    --port <port>       Proxy port (default: 4337)
    --vibe-port <port>  Vibe server port (default: 2337)
    --help              Show this help
`)
      process.exit(0)
    }
  }

  createVibeProxy({ target, proxyPort, vibePort })
}

export default createVibeProxy
