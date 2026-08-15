// Writes .expo/types/router.d.ts, the file that gives `typedRoutes` its meaning.
//
// This has to run before `tsc`. Without the declaration file, expo-router's
// `Href` type falls back to plain `string`, every `router.push` accepts any
// path, and `yarn typecheck` passes while checking nothing. That silent pass is
// worse than a failure, because CI then reports a green run on an unchecked
// codebase.
//
// `.expo/` is gitignored, so a fresh checkout — every CI run — starts without
// the file. Only the dev server writes it during development, and CI does not
// start one. `expo export` does not write it either. This script produces the
// same file with no server and no bundle.
//
// It calls `getTypedRoutesDeclarationFile` rather than the neighbouring
// `regenerateDeclarations`, because that wrapper is debounced: it schedules the
// write on a timer, so a short-lived process exits before the file appears.
const fs = require('node:fs')
const path = require('node:path')
const {
  getTypedRoutesDeclarationFile,
} = require('expo-router/build/typed-routes/generate')
const requireContext =
  require('expo-router/build/testing-library/require-context-ponyfill').default
const { EXPO_ROUTER_CTX_IGNORE } = require('expo-router/_ctx-shared')

const appRoot = path.join(__dirname, '..', 'app')
const outputDir = path.join(__dirname, '..', '.expo', 'types')

// The same require.context ponyfill the dev server builds, over the same app
// directory and the same ignore list, so this file matches what Metro writes.
const ctx = requireContext(appRoot, true, EXPO_ROUTER_CTX_IGNORE)
const declaration = getTypedRoutesDeclarationFile(ctx)

if (!declaration) {
  console.error('Route type generation produced no output. Is the app/ directory empty?')
  process.exit(1)
}

fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(path.join(outputDir, 'router.d.ts'), declaration)
