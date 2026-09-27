// Writes sitemap.xml into the export folder, from the prerender seed. The
// deploy runs this after `expo export`, so the file sits beside index.html.
//
// The pages listed are the ones the export wrote a static file for: the home
// page, each genre page, and each seeded film. A film outside the seed has no
// file on the host, so it is not listed. See lib/prerender.ts.
//
// SITE_URL is the public address of the site with no trailing slash. The
// deploy passes the one GitHub Pages reports. The default is the value
// lib/share.ts holds, which the script cannot import from plain Node.
const fs = require('node:fs')
const path = require('node:path')

const SEED = path.join(__dirname, '..', 'lib', 'prerender.json')
const DEFAULT_SITE_URL = 'https://raajnadar.github.io/reelist'

const outputDir = process.argv[2]
if (!outputDir) {
  console.error('Usage: node scripts/sitemap.js <export folder>')
  process.exit(1)
}

const siteUrl = (process.env.SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, '')

const escapeXml = (text) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

const seed = JSON.parse(fs.readFileSync(SEED, 'utf8'))

// The genre link carries the name, the same as the chips on the home page,
// so the sitemap names the page by the address the site links to.
const genreUrls = seed.genres.map(
  (genre) => `${siteUrl}/genre/${genre.id}?name=${encodeURIComponent(genre.name)}`,
)
const movieUrls = Object.keys(seed.movies)
  .map(Number)
  .sort((a, b) => a - b)
  .map((id) => `${siteUrl}/movie/${id}`)

const urls = [`${siteUrl}/`, ...genreUrls, ...movieUrls]

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`),
  '</urlset>',
  '',
].join('\n')

const output = path.join(outputDir, 'sitemap.xml')
fs.writeFileSync(output, xml)
console.log(`Wrote ${urls.length} URLs to ${path.relative(process.cwd(), output)}.`)
