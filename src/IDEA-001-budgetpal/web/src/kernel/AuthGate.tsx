import { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { HealthDot } from './HealthDot';
import { Shell } from './Shell';
import { isPublic, type Feature } from './registry';
import { useSession, useSignOut } from './session';

/** The only pages an anonymous visitor may open; every other URL goes to `/login`. */
const ANONYMOUS_PATHS = ['/login', '/signup'];

/** Pages a user must never be sent back to after signing in. */
const NEVER_RETURN_TO = [...ANONYMOUS_PATHS, '/logout'];

/**
 * Where to go once signed in: the `from` this gate left in router state when it sent the visitor to
 * `/login`, but only when it is a same-origin path (one leading slash, not `//host`, no backslash,
 * no scheme) that is not an auth page. Anything else, including a missing `from`, lands on `/`.
 * Router state only: nothing is read from the URL or from browser storage (SR-015, GR-013).
 */
export function safeTarget(state: unknown): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown } } | null | undefined)?.from;
  if (typeof from !== 'object' || from === null) return '/';
  const { pathname, search } = from;
  if (typeof pathname !== 'string' || !isPlainPath(pathname)) return '/';
  if (!pathname.startsWith('/') || pathname.startsWith('//')) return '/';
  if (NEVER_RETURN_TO.includes(pathname.replace(/\/+$/, '') || '/')) return '/';
  if (search === undefined || search === '') return pathname;
  if (typeof search !== 'string' || !search.startsWith('?') || !isPlainPath(search)) return '/';
  return `${pathname}${search}`;
}

/** No backslash (browsers read `/\host` as `//host`) and no control character. */
function isPlainPath(value: string): boolean {
  for (const char of value) {
    if (char === '\\' || char.charCodeAt(0) < 32) return false;
  }
  return true;
}

interface AuthGateProps {
  features: Feature[];
}

function LogOutControl() {
  const signOut = useSignOut();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  const onClick = () => {
    setFailed(false);
    // The promise form still resolves after this control unmounts (the session turns anonymous first).
    signOut.mutateAsync().then(
      () => navigate('/login', { replace: true }),
      () => setFailed(true),
    );
  };

  return (
    <>
      <button type="button" className="gate-button" onClick={onClick} disabled={signOut.isPending}>
        Log out
      </button>
      {failed ? <p role="alert">Log out failed. Try again.</p> : null}
    </>
  );
}

/**
 * The UX guard in front of the shell. It decides from the session what to show; the API stays the
 * authority (a bypassed page still gets 401, which the query client turns into an anonymous
 * session). The remembered target travels in router state only (SR-015, GR-013).
 */
export function AuthGate({ features }: AuthGateProps) {
  const session = useSession();
  const location = useLocation();

  if (session.status === 'loading') {
    return (
      <main className="gate-main">
        <p role="status">Loading...</p>
      </main>
    );
  }

  if (session.status === 'error') {
    return (
      <main className="gate-main">
        <div role="alert">
          <p>We could not check your session. Please try again.</p>
          <button type="button" className="gate-button" onClick={session.retry}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  const publicFeatures = features.filter(isPublic);

  if (session.status === 'anonymous') {
    const bare = publicFeatures.filter((feature) => ANONYMOUS_PATHS.includes(feature.path));
    return (
      <Routes>
        {bare.map((feature) => (
          <Route
            key={feature.id}
            path={feature.path}
            element={
              <main className="gate-main">
                <feature.component />
              </main>
            }
          />
        ))}
        <Route
          path="*"
          element={
            <Navigate
              to="/login"
              replace
              state={{ from: { pathname: location.pathname, search: location.search } }}
            />
          }
        />
      </Routes>
    );
  }

  const protectedFeatures = features.filter((feature) => !isPublic(feature));
  // The one owner of the post-sign-in navigation: the pages only flip the session, and this redirect
  // (decided in the same render that sees the session turn authenticated) is the only move.
  const afterSignIn = safeTarget(location.state);
  return (
    <Routes>
      {publicFeatures.map((feature) =>
        ANONYMOUS_PATHS.includes(feature.path) ? (
          <Route key={feature.id} path={feature.path} element={<Navigate to={afterSignIn} replace />} />
        ) : (
          <Route
            key={feature.id}
            path={feature.path}
            element={
              <main className="gate-main">
                <feature.component />
              </main>
            }
          />
        ),
      )}
      <Route path="*" element={<Shell features={protectedFeatures} actions={<LogOutControl />} footer={<HealthDot />} />} />
    </Routes>
  );
}
