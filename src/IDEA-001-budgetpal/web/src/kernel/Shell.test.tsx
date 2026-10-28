import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { Shell } from './Shell';
import { buildRegistry } from './registry';

function Fake() {
  return <h1>Fake heading</h1>;
}
function Other() {
  return <h1>Other heading</h1>;
}

const registry = buildRegistry({
  '../features/other/feature.ts': { default: { id: 'other', path: '/other', label: 'Other', order: 20, component: Other } },
  '../features/fake/feature.ts': { default: { id: 'fake', path: '/', label: 'Fake', order: 10, component: Fake } },
});

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function renderShell(path = '/', footer?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]} future={routerFuture}>
      <Shell features={registry} footer={footer} />
    </MemoryRouter>,
  );
}

const kernelDir = __dirname;
const webDir = resolve(__dirname, '..', '..');

describe('Shell with fake features', () => {
  it('SPEC-010 T-036 shows the nav in registry order and the route content with no shared-file edit', () => {
    renderShell('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Fake', 'Other']);
    expect(screen.getByRole('heading', { name: 'Fake heading' })).toBeInTheDocument();
  });

  it('SPEC-010 T-036 renders the second feature on its own path and a not-found page elsewhere', () => {
    const { unmount } = renderShell('/other');
    expect(screen.getByRole('heading', { name: 'Other heading' })).toBeInTheDocument();
    unmount();
    renderShell('/missing');
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});

describe('Shell top bar', () => {
  it('SPEC-010 T-039 shows the current page title as plain text and the page keeps exactly one h1', () => {
    renderShell('/other');
    const banner = screen.getByRole('banner');
    const title = within(banner).getByText('Other');
    expect(title.tagName).toBe('SPAN');
    expect(within(banner).queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('SPEC-010 T-039 follows the route and falls back to the app name on an unknown page', () => {
    const first = renderShell('/');
    expect(within(screen.getByRole('banner')).getByText('Fake')).toBeInTheDocument();
    first.unmount();
    renderShell('/missing');
    expect(within(screen.getByRole('banner')).getByText('BudgetPal')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('SPEC-010 T-039 renders no user menu without a user and puts the footer slot in the sidebar', () => {
    renderShell('/', <span>footer content</span>);
    expect(within(screen.getByRole('banner')).queryByRole('button')).not.toBeInTheDocument();
    const footer = document.querySelector('[data-sidebar="footer"]');
    expect(footer).not.toBeNull();
    expect(within(footer as HTMLElement).getByText('footer content')).toBeInTheDocument();
  });

  it('SPEC-010 T-039 renders no sidebar footer when no footer content is given', () => {
    renderShell('/');
    expect(document.querySelector('[data-sidebar="footer"]')).toBeNull();
  });
});

describe('Shell landmarks and files', () => {
  it('SPEC-010 T-042 has the skip link, nav, main#main and banner, and no serious or critical axe violation', async () => {
    const { container } = renderShell('/');
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(screen.getAllByRole('main')).toHaveLength(1);

    // jsdom has no layout engine, so colour contrast is proven by the token-pair test (SPEC-010 T-008).
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it('SPEC-010 T-042 deletes shell.css and main.tsx imports index.css in its place', () => {
    expect(existsSync(resolve(kernelDir, 'shell.css'))).toBe(false);
    const main = readFileSync(resolve(webDir, 'src', 'main.tsx'), 'utf8');
    expect(main).toMatch(/import\s+['"]\.\/index\.css['"]/);
    expect(main).not.toContain('shell.css');
  });

  it('SPEC-010 T-042 no kernel source keeps a shell.css class or an inline style object', () => {
    for (const name of ['Shell.tsx', 'AppSidebar.tsx', 'AuthGate.tsx']) {
      const text = readFileSync(resolve(kernelDir, name), 'utf8');
      expect(text, name).not.toMatch(/shell\.css|gate-main|gate-button|shell-header|skip-link/);
      expect(text, name).not.toMatch(/style=\{\{/);
    }
  });
});
