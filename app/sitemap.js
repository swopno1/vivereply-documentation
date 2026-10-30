import fs from 'fs'
import path from 'path'

// Canonical public base — the docs are served via rewrite at www.vivereply.com/docs
const SITE_URL = 'https://www.vivereply.com/docs'

function collectPages(dir, base = '') {
  const pages = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    // Skip Nextra meta files and non-content
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      pages.push(...collectPages(fullPath, `${base}/${entry.name}`))
    } else if (/\.(md|mdx)$/.test(entry.name)) {
      const name = entry.name.replace(/\.(md|mdx)$/, '')
      // index.md -> section URL, other.md -> page URL
      const urlPath = name === 'index' ? base : `${base}/${name}`
      pages.push(urlPath || '/')
    }
  }
  return pages
}

export default function sitemap() {
  const contentDir = path.join(process.cwd(), 'content')
  const now = new Date()
  let pages = []
  try {
    pages = collectPages(contentDir)
  } catch {
    // Fail silently if content directory is unavailable
  }
  return pages.map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: p === '/' ? 0.9 : 0.7,
  }))
}
