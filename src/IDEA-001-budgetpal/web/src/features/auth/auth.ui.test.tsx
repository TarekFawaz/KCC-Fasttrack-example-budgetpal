import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setMatchMedia } from '../../test/setup';
import { LoginPage } from './LoginPage';
import { SignUpPage } from './SignUpPage';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
const here = dirname(fileURLToPath(import.meta.url));

function renderAt(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]} future={routerFuture}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
        </Routes>
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

describe('SPEC-010 Story-002 auth restyle', () => {
  it.each(['/login', '/signup'])(
    'SPEC-010 T-022 %s uses Card, Label, Input and Button; errors sit beside the field with icon, aria-invalid and aria-describedby, and focus goes to the first one',
    async (path) => {
      const { container } = renderAt(path);
      expect(container.querySelector('.bg-card')).not.toBeNull();
      const email = screen.getByLabelText('Email');
      const password = screen.getByLabelText('Password');
      expect(email.className).toMatch(/border-input/);
      const submit = screen.getAllByRole('button').find((button) => button.getAttribute('type') === 'submit') as HTMLElement;
      expect(submit.className).toMatch(/bg-primary/);

      fireEvent.click(submit);
      await waitFor(() => expect(email).toHaveFocus());
      expect(email).toHaveAttribute('aria-invalid', 'true');
      const error = document.getElementById(email.getAttribute('aria-describedby') ?? '') as HTMLElement;
      expect(error).not.toBeNull();
      expect(error.textContent).toMatch(/^⚠ \S/);
      expect(error.querySelector('[aria-hidden="true"]')).toHaveTextContent('⚠');
      expect(password.getAttribute('aria-invalid')).toBe('true');
    },
  );

  it.each([
    ['light', false],
    ['dark', true],
  ])('SPEC-010 T-027 axe finds no serious or critical violation on login and sign-up, with errors shown (%s)', async (_name, dark) => {
    setMatchMedia({ dark });
    document.documentElement.classList.toggle('dark', dark);
    for (const path of ['/login', '/signup']) {
      const view = renderAt(path);
      expect(await seriousViolations(view.container)).toEqual([]);
      const submit = screen.getAllByRole('button').find((button) => button.getAttribute('type') === 'submit') as HTMLElement;
      fireEvent.click(submit);
      await waitFor(() => expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true'));
      expect(await seriousViolations(view.container)).toEqual([]);
      view.unmount();
    }
  });

  it('SPEC-010 T-027 the fields, the button and the link are keyboard reachable with the focus ring class', () => {
    renderAt('/login');
    const controls = [screen.getByLabelText('Email'), screen.getByLabelText('Password'), screen.getAllByRole('button')[0], screen.getByRole('link')];
    for (const control of controls) {
      expect(control).toBeDefined();
      (control as HTMLElement).focus();
      expect(control).toHaveFocus();
      expect((control as HTMLElement).className).toMatch(/focus-visible:ring-|underline|hover:/);
    }
  });

  it('SPEC-010 T-027 no fixed width over 360 px in the auth sources', () => {
    for (const file of sources()) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(/(?:^|[\s"'`:])(?:min-)?w-(?:\[(\d+(?:\.\d+)?)(px|rem)\]|(\d+(?:\.\d+)?))(?=[\s"'`\\]|$)/gm)) {
        const px = match[1] ? Number(match[1]) * (match[2] === 'rem' ? 16 : 1) : Number(match[3]) * 4;
        expect(px, `${file}: ${match[0].trim()}`).toBeLessThanOrEqual(360);
      }
    }
  });

  it('SPEC-010 T-028 the auth sources have no CSS module, no inline style object and no hard-coded colour', () => {
    expect(existsSync(join(here, 'auth.module.css'))).toBe(false);
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
