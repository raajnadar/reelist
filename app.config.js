// Expo reads app.json first and passes its values to this file as `config`.
// `app.json` stays the source of truth: this file changes one field.
//
// Without a custom domain, GitHub Pages serves a project site from a subpath
// (/reelist/), not from the domain root. The default export writes absolute
// asset paths (/_expo/...), which 404 under that subpath. `experiments.baseUrl`
// prefixes every bundled resource, so the export matches where Pages serves it.
// The custom domain reelist.raajnadar.in serves from the root, so the deploy
// passes an empty value today.
//
// The variable is set only by the deploy workflow. A local `expo start` and a
// local `expo export` see no baseUrl and keep serving from the root.
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL ?? ''

  return {
    ...config,
    experiments: {
      ...config.experiments,
      baseUrl,
    },
  }
}
