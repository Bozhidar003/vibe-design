/**
 * Screenshot capture using html2canvas (loaded dynamically)
 * Off by default, toggled on via the prompt panel
 */

let html2canvasLoaded: any = null

async function loadHtml2Canvas(): Promise<any> {
  if (html2canvasLoaded) return html2canvasLoaded

  // Dynamically load html2canvas from CDN
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
    script.onload = () => {
      html2canvasLoaded = (window as any).html2canvas
      resolve(html2canvasLoaded)
    }
    script.onerror = () => reject(new Error('Failed to load html2canvas'))
    document.head.appendChild(script)
  })
}

export async function captureScreenshots(
  el: HTMLElement
): Promise<{ elementCrop: string; viewportWithBoundingBox: string }> {
  const html2canvas = await loadHtml2Canvas()
  const rect = el.getBoundingClientRect()
  const padding = 24

  // 1. Element crop — high res
  const elementCrop = await html2canvas(document.body, {
    x: Math.max(0, rect.x - padding),
    y: Math.max(0, rect.y - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    scale: window.devicePixelRatio,
    useCORS: true,
    logging: false,
    ignoreElements: (el: Element) => el.id === 'vibe-design-host',
  })

  // 2. Full viewport with bounding box — lower res for context
  const viewportCapture = await html2canvas(document.body, {
    scale: 1,
    useCORS: true,
    logging: false,
    ignoreElements: (el: Element) => el.id === 'vibe-design-host',
  })

  // Draw red bounding box on viewport capture
  const ctx = viewportCapture.getContext('2d')
  if (ctx) {
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 3
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height)
  }

  return {
    elementCrop: elementCrop.toDataURL('image/png'),
    viewportWithBoundingBox: viewportCapture.toDataURL('image/png'),
  }
}
