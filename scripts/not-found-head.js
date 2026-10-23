// Writes the head tags into dist/+not-found.html after `expo export`.
//
// From Expo SDK 58 the static export reads the head of a page from the
// `generateMetadata` export of its route, and it does not call that export
// for the not-found route. The page then has no title and no `noindex`, and
// `rootnative-seo audit` fails on it. This script writes the same head that
// `PageHead` renders on the client, so the file and the hydrated page agree.
//
// The script runs on plain Node. Node strips the types of lib/site.ts itself,
// and that file imports nothing from react-native, so no bundler is needed.
const fs = require('node:fs')
const path = require('node:path')
const { headTagsHtml, toHeadTags } = require('@rootnative/seo')
const { notFoundMeta, site } = require('../lib/site.ts')

const outDir = process.argv[2] ?? 'dist'
const file = path.join(outDir, '+not-found.html')

if (!fs.existsSync(file)) {
  console.error(`[not-found-head] ${file} is missing. Run the web export first.`)
  process.exit(1)
}

const page = fs.readFileSync(file, 'utf8')
if (page.includes('<title>')) {
  console.log(`[not-found-head] ${file} already has a head. No change.`)
  process.exit(0)
}

const head = headTagsHtml(toHeadTags(site, notFoundMeta))
fs.writeFileSync(file, page.replace('</head>', `${head}</head>`))
console.log(`[not-found-head] wrote the head of ${file}`)
