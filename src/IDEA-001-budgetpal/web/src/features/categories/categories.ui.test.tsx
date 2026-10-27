import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import axe from 'axe-core';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setMatchMedia } from '../../test/setup';
import { CategoriesPage } from './CategoriesPage';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
const here = dirname(fileURLToPath(import.meta.url));

interface Stored {
  id: number;
  name: string;
  kind: 'expense' | 'income';
  createdAt: string;
}
const stored = (id: number, name: string, kind: Stored['kind']): Stored => ({ id, name, kind, createdAt: '2026-01-01T00:00:00.000Z' });
const LIST = [stored(1, 'Food', 'expense'), stored(2, 'Salary', 'income')];

const json = (status: number, body: unknown, type = 'application/json') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': type } });

function mockApi(onDelete: () => Response = () => new Response(null, { status: 204 })) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url === '/api/categories') return json(200, LIST);
      if (method === 'PUT') {
        const body = JSON.parse(String(init?.body)) as { name: string; kind: Stored['kind'] };
        return json(200, { ...LIST[0], ...body });
      }
      if (method === 'DELETE') return onDelete();
      throw new Error(`unexpected request ${method} ${url}`);
    }),
  );
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/categories']} future={routerFuture}>
        <CategoriesPage />
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

describe('SPEC-010 Story-002 categories restyle', () => {
  it('SPEC-010 T-025 the kind is a Badge with an icon and text; rename and kind change happen inline in the row', async () => {
    mockApi();
    renderPage();
    const expenses = await screen.findByRole('region', { name: 'Expense categories' });
    const row = within(expenses).getAllByRole('listitem')[0] as HTMLElement;
    const badge = within(row).getByText('Expense').parentElement as HTMLElement;
    expect(badge.className).toMatch(/\brounded-full\b/);
    expect(badge.querySelector('[aria-hidden="true"]')).toHaveTextContent('↓');

    fireEvent.click(within(row).getByRole('button', { name: 'Edit Food' }));
    const name = screen.getByLabelText('Name', { selector: `#category-row-1-name` });
    expect(name).toHaveFocus();
    expect(name.className).toMatch(/border-input/);
    fireEvent.change(name, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Food' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/^⚠ Name is required\./);
    expect(name).toHaveAttribute('aria-invalid', 'true');
  });

  it('SPEC-010 T-025 a refused delete says why beside the row', async () => {
    mockApi(() =>
      json(409, { type: 'about:blank', title: 'Conflict', status: 409, detail: 'in use' }, 'application/problem+json'),
    );
    renderPage();
    const expenses = await screen.findByRole('region', { name: 'Expense categories' });
    const row = within(expenses).getAllByRole('listitem')[0] as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Delete Food' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Confirm delete Food' }));
    const message = await within(row).findByRole('alert');
    expect(message).toHaveTextContent('Food is in use and cannot be deleted.');
    expect(message.textContent).toMatch(/^⚠ /);
  });

  it.each([
    ['light', false],
    ['dark', true],
  ])('SPEC-010 T-027 axe finds no serious or critical violation on categories, also while editing (%s)', async (_name, dark) => {
    setMatchMedia({ dark });
    document.documentElement.classList.toggle('dark', dark);
    mockApi();
    const { container } = renderPage();
    await screen.findByRole('region', { name: 'Expense categories' });
    expect(await seriousViolations(container)).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Food' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Food' })).toBeInTheDocument());
    expect(await seriousViolations(container)).toEqual([]);
  });

  it('SPEC-010 T-027 controls are reachable with the focus ring class; no fixed width over 360 px', async () => {
    mockApi();
    renderPage();
    await screen.findByRole('region', { name: 'Expense categories' });
    const controls = [
      screen.getByLabelText('Name'),
      screen.getByLabelText('Kind'),
      screen.getByRole('button', { name: 'Add category' }),
      screen.getByRole('button', { name: 'Edit Food' }),
      screen.getByRole('button', { name: 'Delete Food' }),
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
    expect(existsSync(join(here, 'CategoriesPage.module.css'))).toBe(false);
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
