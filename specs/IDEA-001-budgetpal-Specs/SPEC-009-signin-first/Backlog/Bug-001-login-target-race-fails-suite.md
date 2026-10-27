# Bug-001: Login does not reliably return to the remembered target; T-022 fails the full web suite

| Type | Parent | Source | Severity | Status | Story / AC | Regression test | Evidence |
|--|--|--|--|--|--|--|--|
| Bug | [[../SPEC-009-signin-first]] | verifier | major | verified | Story-002 / AC-2 | T-022 | [[../../../../TestResults/IDEA-001/SPEC-009/Story-002-AC-2-Bug-001]] |

## Reproduce
1. From `src/IDEA-001-budgetpal`: `pnpm --filter @budgetpal/web test:coverage` (the command `quality-gate` runs as QG-COV). It fails 3 of 3 runs.
2. The failing test is `auth.test.tsx > return to the target after sign-in > T-022 a visitor sent from /budgets?month=2026-10 lands there after logging in`. The DOM dump at the timeout shows the dashboard at `/` instead of "Budgets page" at `/budgets?month=2026-10`.
3. The plain `pnpm --filter @budgetpal/web test` failed once in four runs with the same assertion. Run alone, the file passes (42/42, also with `--coverage`).

## Expected / Actual
- Expected: spec AC-2 and Story-002 AC-2: after a successful login the user lands on the remembered target (`/budgets?month=2026-10`); `/` only when there is none.
- Actual: when the suite is under load the user ends on `/`. `useLogIn.onSuccess` makes the session `authenticated`; `AuthGate` then renders `<Navigate to="/" replace />` for `/login` (Story-001 AC-4) at the same time as `LoginPage` calls `navigate(target)` from the `mutateAsync().then(...)`. Two competing navigations decide the final location by timing, so the remembered target is lost. The race is in the code (`AuthGate.tsx` redirect for signed-in `/login` and `/signup` ignores `location.state.from`; `LoginPage.tsx` / `SignUpPage.tsx` navigate afterwards), not only in the test.
- Consequence: QG-COV fails (exit 1), so `quality-gate -Spec SPEC-009` exits 1.

## Fix
- `AuthGate` is the single owner of the post-sign-in move: its signed-in redirect for `/login` and `/signup` goes to `safeTarget(location.state)` (moved into `kernel/AuthGate.tsx`, same-origin rules unchanged, kernel imports no feature). `LoginPage` and `SignUpPage` no longer navigate on success.
- Regression tests (T-022 / T-023, `auth.test.tsx`), red first: the gate alone sends a signed-in visitor at `/login` and `/signup` to the remembered target (red: landed on `/`); the pages do not navigate themselves (red: they did). The login and sign-up T-022 cases now assert the final location after pending work has run.
- Evidence: `test:coverage` exit 0 x3 (337 tests, 98.4% lines); 3 concurrent `test` runs 337/337; build and lint exit 0; `quality-gate -Spec SPEC-009` (SAST left out, H-001) exit 0 with QG-COV PASS.

## Impacted Files
- `src/IDEA-001-budgetpal/web/src/kernel/AuthGate.tsx` (the signed-in redirect for `/login` and `/signup`; it may only use a same-origin `from` it validates itself, the kernel must not import `features/*`)
- `src/IDEA-001-budgetpal/web/src/features/auth/LoginPage.tsx`, `SignUpPage.tsx` (one owner for the post-login navigation)
- `src/IDEA-001-budgetpal/web/src/features/auth/auth.test.tsx` (make T-022 deterministic: assert the final location after the session flips, and cover the sign-up twin)
