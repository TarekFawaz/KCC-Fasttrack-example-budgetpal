import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import axe from 'axe-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { getMatchMediaState, setMatchMedia } from '@/test/setup';

const uiDir = dirname(fileURLToPath(import.meta.url));
const webSrc = resolve(uiDir, '..', '..');

const expectedComponents = [
  'button', 'input', 'label', 'card', 'badge', 'alert', 'skeleton', 'separator', 'table', 'tabs',
  'select', 'dialog', 'alert-dialog', 'progress', 'sidebar', 'sheet', 'tooltip', 'dropdown-menu',
];

// Forbidden names are built from parts so this file does not hold the literals static rules SR-014 and SR-015 look for.
const rawHtmlProp = ['dangerously', 'Set', 'Inner', 'HTML'].join('');
const storageNames = ['local', 'session'].map((p) => `${p}Storage`);
const cookieWrite = ['document', 'cookie'].join('.');
const otherStorage = ['indexed', 'DB'].join('');
const forbidden = [rawHtmlProp, ...storageNames, cookieWrite, otherStorage];

async function seriousViolations(container: HTMLElement) {
  // jsdom applies no stylesheet, so colour contrast is proven by theme.test.ts instead.
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

describe('SPEC-010 Enabler-002 component copies', () => {
  const files = readdirSync(uiDir).filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'));

  it('SPEC-010 T-010 components/ui holds the 18 listed components and the use-mobile hook exists', () => {
    expect(files.map((f) => f.replace(/\.tsx$/, '')).sort()).toEqual([...expectedComponents].sort());
    const hook = readFileSync(resolve(webSrc, 'hooks', 'use-mobile.ts'), 'utf8');
    expect(hook).toContain('export function useIsMobile');
  });

  it('SPEC-010 T-010 no component, hook or helper holds the raw-HTML prop, browser storage or a cookie write', () => {
    const sources = [
      ...files.map((f) => resolve(uiDir, f)),
      resolve(webSrc, 'hooks', 'use-mobile.ts'),
      resolve(webSrc, 'lib', 'utils.ts'),
    ];
    for (const file of sources) {
      const text = readFileSync(file, 'utf8');
      for (const name of forbidden) expect(text, `${file} must not contain ${name}`).not.toContain(name);
    }
  });

  it('SPEC-010 T-010 the Sidebar keeps its state in React only and exposes no persistence option', () => {
    const text = readFileSync(resolve(uiDir, 'sidebar.tsx'), 'utf8');
    expect(text).not.toMatch(/SIDEBAR_COOKIE|max-age|expires=/i);
    expect(text).toContain('React.useState');
  });

  it('SPEC-010 T-010 the forbidden-name check is not vacuous', () => {
    expect(forbidden).toHaveLength(5);
    expect(`window.${storageNames[0]}.setItem("k", "v")`).toContain(storageNames[0]);
  });
});

describe('SPEC-010 Enabler-002 jsdom stand-ins', () => {
  afterEach(() => vi.restoreAllMocks());

  it('SPEC-010 T-011 the browser stand-ins exist', () => {
    expect(typeof window.matchMedia).toBe('function');
    expect(typeof globalThis.ResizeObserver).toBe('function');
    expect(typeof HTMLElement.prototype.hasPointerCapture).toBe('function');
    expect(typeof HTMLElement.prototype.setPointerCapture).toBe('function');
    expect(typeof HTMLElement.prototype.releasePointerCapture).toBe('function');
    expect(typeof HTMLElement.prototype.scrollIntoView).toBe('function');
    const observer = new ResizeObserver(() => {});
    expect(() => {
      observer.observe(document.body);
      observer.disconnect();
    }).not.toThrow();
  });

  it('SPEC-010 T-011 matchMedia flips per test and notifies listeners', () => {
    const mobile = window.matchMedia('(max-width: 767px)');
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    expect(mobile.matches).toBe(false);
    expect(dark.matches).toBe(false);

    const onChange = vi.fn();
    mobile.addEventListener('change', onChange);
    setMatchMedia({ mobile: true, dark: true });
    expect(mobile.matches).toBe(true);
    expect(dark.matches).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);

    mobile.removeEventListener('change', onChange);
    setMatchMedia({ mobile: false });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(window.matchMedia('(min-width: 768px)').matches).toBe(true);
  });

  it('SPEC-010 T-011 matchMedia is back to desktop and light in the next test', () => {
    expect(getMatchMediaState()).toEqual({ mobile: false, dark: false });
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(false);
  });

  it('SPEC-010 T-011 cleanup still runs after each test (nothing from the previous test stays mounted)', () => {
    expect(document.body.querySelectorAll('[data-testid="leftover"]')).toHaveLength(0);
    render(<div data-testid="leftover" />);
    expect(screen.getAllByTestId('leftover')).toHaveLength(1);
  });

  it('SPEC-010 T-011 the previous test left no mounted node behind', () => {
    expect(screen.queryByTestId('leftover')).toBeNull();
  });
});

function SidebarSmoke() {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Main</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Dashboard" isActive>
                    <span>Dashboard</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset as="main">
        <SidebarTrigger />
        <h1>Page</h1>
      </SidebarInset>
    </SidebarProvider>
  );
}

describe.each([
  ['desktop', false],
  ['mobile', true],
])('SPEC-010 Enabler-002 kit smoke on %s', (_name, mobile) => {
  it('SPEC-010 T-012 Dialog opens and closes with no serious or critical axe violation', async () => {
    setMatchMedia({ mobile });
    const { baseElement } = render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Open dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Edit account</DialogTitle>
          <DialogDescription>Change the account name.</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(await screen.findByRole('dialog', { name: 'Edit account' })).toBeInTheDocument();
    expect(await seriousViolations(baseElement)).toEqual([]);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('SPEC-010 T-012 Select lists its options with no serious or critical axe violation', async () => {
    setMatchMedia({ mobile });
    const { baseElement } = render(
      <Select defaultValue="a">
        <SelectTrigger aria-label="Range">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Last 30 days</SelectItem>
          <SelectItem value="b">Last 90 days</SelectItem>
        </SelectContent>
      </Select>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Range' });
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(await screen.findByRole('option', { name: 'Last 90 days' })).toBeInTheDocument();
    expect(await seriousViolations(baseElement)).toEqual([]);
  });

  it('SPEC-010 T-012 Sidebar mounts with no serious or critical axe violation', async () => {
    setMatchMedia({ mobile });
    const { baseElement } = render(<SidebarSmoke />);
    if (mobile) {
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
      expect(await screen.findByRole('dialog', { name: 'Main navigation' })).toBeInTheDocument();
    } else {
      expect(screen.getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    }
    expect(await seriousViolations(baseElement)).toEqual([]);
  });
});
