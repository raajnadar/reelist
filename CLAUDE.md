# CLAUDE.md

This project uses [RootNative UI](https://rootnative.github.io/ui/) (`@rootnative/*`) — a design-system agnostic component library for React Native, with Material Design 3 out of the box — and [Expo Router](https://docs.expo.dev/router/introduction/) for file-based navigation (screens live in `app/`).

## RootNative UI docs for AI agents

Read these before writing code that uses RootNative components:

- `node_modules/@rootnative/components/llms.txt` — all component props for the exact installed version (works offline)
- `node_modules/@rootnative/core/llms.txt` — theme system API (`ThemeProvider`, `useTheme`, `defineTheme`)
- https://rootnative.github.io/ui/llms.txt — hosted overview (latest release)
- https://rootnative.github.io/ui/llms-full.txt — hosted complete API reference (latest release)

Prefer the `node_modules` copies — they match the installed version exactly.
