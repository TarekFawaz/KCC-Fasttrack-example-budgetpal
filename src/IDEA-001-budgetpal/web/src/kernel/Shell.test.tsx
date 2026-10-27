import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Shell } from './Shell';
import { buildRegistry } from './registry';

function Fake() {
  return <p>fake feature content</p>;
}
function Other() {
  return <p>other feature content</p>;
}

const registry = buildRegistry({
  '../features/other/feature.ts': { default: { id: 'other', path: '/other', label: 'Other', order: 20, component: Other } },
  '../features/fake/feature.ts': { default: { id: 'fake', path: '/', label: 'Fake', order: 10, component: Fake } },
});

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function renderShell(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={routerFuture}>
      <Shell features={registry} />
    </MemoryRouter>,
  );
}

describe('Shell with a fake feature', () => {
  it('T-013 shows the nav link in order and the route content with no shared-file edit', () => {
    renderShell('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Fake', 'Other']);
    expect(links[0]).toHaveAttribute('href', '/');
    expect(links[1]).toHaveAttribute('href', '/other');
    expect(screen.getByText('fake feature content')).toBeInTheDocument();
  });

  it('T-013 renders the second feature on its own path and a not-found page elsewhere', () => {
    const { unmount } = renderShell('/other');
    expect(screen.getByText('other feature content')).toBeInTheDocument();
    unmount();
    renderShell('/missing');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('T-014 has header, nav and main landmarks and no serious or critical axe violation', async () => {
    const { container } = renderShell('/');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();

    // jsdom has no layout engine, so colour contrast is checked visually by the verifier.
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

describe('Shell optional slots', () => {
  it('T-017 renders the actions in the banner and the footer content in a footer landmark', () => {
    render(
      <MemoryRouter future={routerFuture}>
        <Shell features={registry} actions={<button type="button">Log out</button>} footer={<span>footer content</span>} />
      </MemoryRouter>,
    );
    expect(within(screen.getByRole('banner')).getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect(within(screen.getByRole('contentinfo')).getByText('footer content')).toBeInTheDocument();
  });

  it('T-017 renders no actions and no footer landmark when the slots are not given', () => {
    renderShell('/');
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('shell.css', () => {
  const css = readFileSync(resolve(__dirname, 'shell.css'), 'utf8');

  it('T-014 has a visible focus style, dark-scheme tokens and a 768 px breakpoint', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px/);
    expect(css).toMatch(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^@]*--bg:/);
    expect(css).toMatch(/@media\s*\(min-width:\s*768px\)/);
    expect(css).toMatch(/:root\s*\{[^}]*--bg:[^}]*--text:/);
  });
});
