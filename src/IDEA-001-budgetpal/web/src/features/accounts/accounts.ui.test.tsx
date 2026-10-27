import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setMatchMedia } from '../../test/setup';
import type { Account } from './accounts.api';
import { AccountsPage } from './AccountsPage';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
const here = dirname(fileURLToPath(import.meta.url));

const account = (id: number, name: string, type: Account['type'], openingBalanceMinor: number): Account => ({
  id,
  name,
  type,
  openingBalanceMinor,
  createdAt: 1,
  updatedAt: 1,
});
const rows = [account(1, 'Main', 'checking', 123450), account(2, 'Card', 'credit_card', -2000)];

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function mockApi(initial: Account[]) {
  const store = [...initial];
  const calls: { method: string; url: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ method, url });
      if (method === 'GET' && url === '/api/accounts') return json(200, store);
      if (method === 'DELETE') {
        const index = store.findIndex((entry) => entry.id === Number(url.split('/').pop()));
        if (index >= 0) store.splice(index, 1);
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected request ${method} ${url}`);
    }),
  );
  return calls;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/accounts']} future={routerFuture}>
        <AccountsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const seriousViolations = async (container: HTMLElement) => {
  // jsdom applies no CSS, so contrast is proven by the token-pair tests, not by axe.
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
};

function sources(): string[] {
  return readdirSync(here, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx|css)$/.test(entry.name) && !/\.test\./.test(entry.name))
    .map((entry) => join(here, entry.name));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove('dark');
});

describe('SPEC-010 Story-002 accounts restyle', () => {
  it('SPEC-010 T-024 the list is a kit Table and Delete opens an alertdialog with focus on Cancel; Escape cancels; no native dialog', async () => {
    const calls = mockApi(rows);
    const { container } = renderPage();
    const table = await screen.findByRole('table');
    expect(table.className).toMatch(/\bw-full\b/);
    // The Table is wrapped in its own scroll container (the kit wrapper), not the page.
    expect(table.parentElement?.className).toMatch(/overflow-x-auto/);
    expect(screen.getByLabelText('Name').className).toMatch(/border-input/);
    expect(screen.getByRole('button', { name: 'Add account' }).className).toMatch(/bg-primary/);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Card' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Card?' });
    expect(dialog).toHaveAccessibleDescription(/cannot be undone/);
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(container.ownerDocument.querySelector('dialog')).toBeNull();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(0);
  });

  it('SPEC-010 T-024 the row leaves only after the api confirms the delete', async () => {
    const calls = mockApi(rows);
    renderPage();
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Card' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete account' }));
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'Card' })).not.toBeInTheDocument());
    expect(calls).toContainEqual({ method: 'DELETE', url: '/api/accounts/2' });
  });

  it.each([
    ['light', false],
    ['dark', true],
  ])('SPEC-010 T-027 axe finds no serious or critical violation on accounts, with the alertdialog open (%s)', async (_name, dark) => {
    setMatchMedia({ dark });
    document.documentElement.classList.toggle('dark', dark);
    mockApi(rows);
    const { container } = renderPage();
    await screen.findByRole('table');
    expect(await seriousViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete Main' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(await seriousViolations(dialog)).toEqual([]);
  });

  it('SPEC-010 T-027 controls are reachable with the focus ring class; no fixed width over 360 px', async () => {
    mockApi(rows);
    renderPage();
    await screen.findByRole('table');
    const controls = [
      screen.getByLabelText('Name'),
      screen.getByLabelText('Type'),
      screen.getByLabelText('Opening balance'),
      screen.getByRole('button', { name: 'Add account' }),
      screen.getByRole('button', { name: 'Edit Main' }),
      screen.getByRole('button', { name: 'Delete Main' }),
    ];
    for (const control of controls) {
      control.focus();
      expect(control).toHaveFocus();
      expect(control.className).toMatch(/focus-visible:ring-/);
    }
    for (const file of sources()) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/(?:^|[\s"'`:])(?:min-)?w-(?:\[(\d+(?:\.\d+)?)(px|rem)\]|(\d+(?:\.\d+)?))(?=[\s"'`\\]|$)/gm)) {
        const px = match[1] ? Number(match[1]) * (match[2] === 'rem' ? 16 : 1) : Number(match[3]) * 4;
        expect(px, `${file}: ${match[0].trim()}`).toBeLessThanOrEqual(360);
      }
    }
  });

  it('SPEC-010 T-028 the CSS module is gone, nothing imports one and no hard-coded colour or inline style remains', () => {
    expect(existsSync(join(here, 'accounts.module.css'))).toBe(false);
    for (const file of sources()) {
      const text = readFileSync(file, 'utf8');
      expect(file.endsWith('.css'), file).toBe(false);
      expect(text, file).not.toMatch(/\.module\.css/);
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, file).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/);
      expect(text, file).not.toMatch(/style=\{\{/);
      expect(text, file).not.toMatch(/\b(?:bg|text|border|fill|stroke)-(?:red|green|blue|yellow|orange|amber|gray|slate|zinc|neutral|stone|white|black)(?:-\d+)?\b/);
    }
  });
});
