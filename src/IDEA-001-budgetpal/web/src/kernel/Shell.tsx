import type { ReactNode } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import type { Feature } from './registry';

interface ShellProps {
  features: Feature[];
  /** Optional controls at the end of the header (the log-out control). */
  actions?: ReactNode;
  /** Optional footer content (the API status dot). The footer landmark renders only when given. */
  footer?: ReactNode;
}

/** Landmark layout: header with the nav built from the registry, and `main` with its routes. */
export function Shell({ features, actions, footer }: ShellProps) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="shell-header">
        <p className="shell-brand">BudgetPal</p>
        <nav aria-label="Main">
          <ul className="shell-nav">
            {features.map((feature) => (
              <li key={feature.id}>
                <NavLink to={feature.path} end={feature.path === '/'}>
                  {feature.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {actions ? <div className="shell-actions">{actions}</div> : null}
      </header>
      <main id="main" className="shell-main" tabIndex={-1}>
        <Routes>
          {features.map((feature) => (
            <Route key={feature.id} path={feature.path} element={<feature.component />} />
          ))}
          <Route
            path="*"
            element={
              <section>
                <h1>Page not found</h1>
                <p>That page does not exist.</p>
              </section>
            }
          />
        </Routes>
      </main>
      {footer ? <footer className="shell-footer">{footer}</footer> : null}
    </div>
  );
}
