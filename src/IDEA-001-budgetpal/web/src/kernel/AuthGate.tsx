import { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Shell } from './Shell';
import { isPublic, type Feature } from './registry';
import { useSession, useSignOut } from './session';

/** The only pages an anonymous visitor may open; every other URL goes to `/login`. */
const ANONYMOUS_PATHS = ['/login', '/signup'];

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
  return (
    <Routes>
      {publicFeatures.map((feature) =>
        ANONYMOUS_PATHS.includes(feature.path) ? (
          <Route key={feature.id} path={feature.path} element={<Navigate to="/" replace />} />
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
      <Route path="*" element={<Shell features={protectedFeatures} actions={<LogOutControl />} />} />
    </Routes>
  );
}
