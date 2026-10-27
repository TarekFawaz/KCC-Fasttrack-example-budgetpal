# Enabler-003: Web shell with feature and nav registry

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-001-walking-skeleton]] | P0 | M | Ready | frontend-react | Enabler-001 | Story-001, Enabler-005 |

## Outcome Statement
Enable later specs to add pages by building the React + Vite shell with a feature registry that creates routes and nav entries from `web/src/features/*/feature.ts`, so that a new feature needs only its own folder.

## Acceptance Criteria
- [ ] AC-1 - Given a file `web/src/features/<x>/feature.ts` exporting `{id, path, label, order, component}`, when the app renders, then the route exists and a nav link appears in `order`, with no edit to a shared file.
- [ ] AC-2 - Given the shell, when it renders, then it has a landmark layout (header with nav, `main`), a visible focus style, light and dark tokens via `prefers-color-scheme`, and a single-column layout below 768 px that works at 360 px.
- [ ] AC-3 - Given the shell, when the code is searched, then it has no `dangerouslySetInnerHTML` and no `localStorage` or `sessionStorage`; server state goes through one TanStack Query client.
- [ ] AC-4 - Given `pnpm --filter web build`, when it runs, then it emits a static bundle and the dev server proxies `/api` to the api (stripping the prefix).

## INVEST
I PASS · N PASS · V PASS (nav contract for 7 specs) · E PASS · S PASS (5 files) · T PASS

## Impacted Files
- `web/package.json` - react, react-dom, vite 5, react-router 6, tanstack query, vitest, testing-library, axe-core
- `web/vite.config.ts` - React plugin, `/api` dev proxy, vitest config
- `web/index.html` - root element, `lang`, viewport meta
- `web/src/main.tsx` - providers, router built from the registry, shell layout and CSS tokens
- `web/src/kernel/registry.ts` - `import.meta.glob('../features/*/feature.ts')` to routes and nav

## Test Hints
- unit: registry sorts by `order`, rejects a duplicate `id` (AC-1)
- integration: Testing Library renders the shell with a fake feature and finds route and link (AC-1); axe on shell (AC-2); grep test for forbidden APIs (AC-3); `vite build` exits 0 (AC-4)
- tests beside the code (not counted in Files)
