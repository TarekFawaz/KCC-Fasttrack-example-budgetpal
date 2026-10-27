# Enabler-001: Tailwind and shadcn toolchain

| Type | Parent | Priority | Estimate | Status | Dialect | Depends on | Blocks |
|--|--|--|--|--|--|--|--|
| Enabler | [[../SPEC-010-shadcn-ui]] | P1 | M | Ready | frontend-react | None | Enabler-002 |

## Outcome Statement
Enable Tailwind CSS and shadcn/ui in `web/` by adding the dependencies, the `@` alias and the build wiring, so that components can be copied in and styled without breaking the existing build, lint and tests.

## Acceptance Criteria
- [ ] AC-1 - Given the web package, then it declares the D-25 dependencies (Tailwind and its Vite or PostCSS integration, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, the Radix primitives and the animation helper the kit needs) with the lockfile updated and `pnpm audit` clean of high production advisories.
- [ ] AC-2 - Given `@/` imports, then Vite and TypeScript both resolve `@` to `web/src`, and `tsc --noEmit` passes.
- [ ] AC-3 - Given `pnpm --filter @budgetpal/web build`, `vitest run` and the workspace lint, then each exits 0 with the new dependencies; `build.test.ts` T-016 (build output and dev proxy rewrite) passes unchanged.
- [ ] AC-4 - Given the web Dockerfile, then it copies every web config file the build now needs (for example `components.json`, and `tailwind.config.ts` and `postcss.config.js` if D-25 picks Tailwind 3) before the build step; the stage names and pinned base tags that SR-018 checks are unchanged. No Docker run is part of the tests.

## INVEST
I PASS · N PASS · V PASS (unblocks every restyle) · E PASS · S PASS · T PASS

## Impacted Files
- `web/package.json` - dependencies, no new scripts
- `pnpm-lock.yaml` - lockfile update (workspace root)
- `web/vite.config.ts` - Tailwind plugin if D-25 picks version 4, `@` alias; the dev proxy rewrite stays as is
- `web/tsconfig.json` - `paths` for `@/*`
- `web/Dockerfile` - COPY of the new config files

## Test Hints
- unit: `build.test.ts` T-016 stays green; a small test imports through `@/` (AC-2)
- check: `tsc`, build, lint and vitest exit codes (AC-3); read the Dockerfile text for the COPY lines and the SR-018 stage names (AC-4)
