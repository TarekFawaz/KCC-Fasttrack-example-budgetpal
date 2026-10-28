import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setMatchMedia } from '@/test/setup';
import { Shell } from './Shell';
import { buildRegistry } from './registry';

function Page({ name }: { name: string }) {
  return <h1>{name} page</h1>;
}
const Dashboard = () => <Page name="Dashboard" />;
const Budgets = () => <Page name="Budgets" />;
const Reports = () => <Page name="Reports" />;

// "reports" has no entry in the icon map: it must still get a (fallback) icon and a name.
const registry = buildRegistry({
  '../features/reports/feature.ts': { default: { id: 'reports', path: '/reports', label: 'Reports', order: 30, component: Reports } },
  '../features/budgets/feature.ts': { default: { id: 'budgets', path: '/budgets', label: 'Budgets', order: 20, component: Budgets } },
  '../features/dashboard/feature.ts': { default: { id: 'dashboard', path: '/', label: 'Dashboard', order: 0, component: Dashboard } },
});

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

function renderShell(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]} future={routerFuture}>
      <Shell features={registry} user={{ email: 'ada@example.com' }} onSignOut={() => Promise.resolve()} footer={<span>status</span>} />
    </MemoryRouter>,
  );
}

async function blocking(container: HTMLElement) {
  // jsdom has no layout engine, so colour contrast is proven by the token-pair test (SPEC-010 T-008).
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`);
}

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

describe('AppSidebar navigation', () => {
  it('SPEC-010 T-036 lists the non-public features in registry order inside nav "Main", each with an icon', () => {
    renderShell('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Dashboard', 'Budgets', 'Reports']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/', '/budgets', '/reports']);
    for (const link of links) {
      const icon = link.querySelector('svg');
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    }
  });

  it('SPEC-010 T-036 gives a feature with no known icon the fallback icon without a shared-file edit', () => {
    renderShell('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const known = within(nav).getByRole('link', { name: 'Budgets' }).querySelector('svg');
    const fallback = within(nav).getByRole('link', { name: 'Reports' }).querySelector('svg');
    expect(fallback).not.toBeNull();
    expect(fallback?.getAttribute('class')).not.toBe(known?.getAttribute('class'));
  });

  it('SPEC-010 T-036 marks only the current page with aria-current="page"', () => {
    renderShell('/budgets');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Budgets' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'Reports' })).not.toHaveAttribute('aria-current');
  });
});

describe('AppSidebar collapse', () => {
  it('SPEC-010 T-037 has a labelled collapse button that toggles to icons and back', () => {
    renderShell('/');
    const collapse = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(collapse);
    const expand = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(document.querySelector('[data-collapsible="icon"]')).not.toBeNull();
    fireEvent.click(expand);
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
    expect(document.querySelector('[data-collapsible="icon"]')).toBeNull();
  });

  it('SPEC-010 T-037 keeps the entry names when collapsed and shows the tooltip text on focus', async () => {
    renderShell('/');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const name of ['Dashboard', 'Budgets', 'Reports']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    fireEvent.focus(within(nav).getByRole('link', { name: 'Budgets' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Budgets');
  });

  it('SPEC-010 T-037 writes nothing to browser storage or cookies when collapsing', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    const cookie = vi.spyOn(document, 'cookie', 'set');
    renderShell('/');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(local).not.toHaveBeenCalled();
    expect(cookie).not.toHaveBeenCalled();
    expect(document.cookie).toBe('');
  });

  it('SPEC-010 T-037 starts expanded again on a fresh mount (the state is not persisted)', () => {
    const first = renderShell('/');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    first.unmount();
    renderShell('/');
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  });
});

describe('AppSidebar on a phone', () => {
  it('SPEC-010 T-038 hides the sidebar and opens it in a Sheet from "Open menu"', async () => {
    setMatchMedia({ mobile: true });
    renderShell('/');
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /collapse sidebar/i })).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('link')).toHaveLength(3);
  });

  it('SPEC-010 T-038 closes the Sheet with Escape and returns focus to the button', async () => {
    setMatchMedia({ mobile: true });
    renderShell('/');
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('SPEC-010 T-038 closes the Sheet after navigation and shows the new page', async () => {
    setMatchMedia({ mobile: true });
    renderShell('/');
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('link', { name: 'Budgets' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Budgets page' })).toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('SPEC-010 T-038 uses no fixed width over 360 px and no horizontal overflow class in the shell chrome', () => {
    setMatchMedia({ mobile: true });
    const { container } = renderShell('/');
    const classes = Array.from(container.querySelectorAll('[class]'))
      .map((element) => element.getAttribute('class') ?? '')
      .join(' ');
    expect(classes).not.toMatch(/overflow-x-(scroll|auto)/);
    for (const match of classes.matchAll(/(?:^|\s)w-\[(\d+)px\]/g)) {
      expect(Number(match[1])).toBeLessThanOrEqual(360);
    }
    expect(container.querySelector('main')?.className).toContain('min-w-0');
  });
});

describe('AppSidebar accessibility', () => {
  const cases = [
    ['light', false],
    ['dark', true],
  ] as const;

  it.each(cases)('SPEC-010 T-043 expanded and collapsed states have no serious or critical axe violation (%s)', async (_name, dark) => {
    setMatchMedia({ dark });
    document.documentElement.classList.toggle('dark', dark);
    const { container } = renderShell('/budgets');
    expect(await blocking(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(await blocking(container)).toEqual([]);
  });

  it.each(cases)('SPEC-010 T-043 the open mobile Sheet has no serious or critical axe violation (%s)', async (_name, dark) => {
    setMatchMedia({ mobile: true, dark });
    document.documentElement.classList.toggle('dark', dark);
    renderShell('/');
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    await screen.findByRole('dialog');
    expect(await blocking(document.body)).toEqual([]);
  });

  it('SPEC-010 T-043 every control in the chrome carries a visible focus ring', async () => {
    renderShell('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const controls = [
      screen.getByRole('button', { name: 'Collapse sidebar' }),
      screen.getByRole('button', { name: 'ada@example.com' }),
      ...within(nav).getAllByRole('link'),
    ];
    for (const control of controls) {
      expect(control.className).toMatch(/focus-visible:ring/);
    }
    // The skip link and the global rule cover everything else: :focus-visible has a 3 px outline in index.css.
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
  });
});
