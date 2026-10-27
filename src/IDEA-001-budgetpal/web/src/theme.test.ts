// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import tailwindConfig from '../tailwind.config';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(resolve(webRoot, p), 'utf8');
const css = read('src/index.css');

type Tokens = Record<string, string>;

/** Returns the body of the first `{ ... }` block opened at or after `from`. */
function block(text: string, from: number): string {
  const open = text.indexOf('{', from);
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  throw new Error('unbalanced braces in index.css');
}

function declarations(body: string): Tokens {
  const out: Tokens = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1] as string] = (m[2] as string).trim();
  return out;
}

const lightBody = block(css, css.indexOf(':root'));
const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
const darkBody = block(css, css.indexOf(':root', darkStart));
const light = declarations(lightBody);
const dark = { ...light, ...declarations(darkBody) };

function rgb(value: string): [number, number, number] {
  const m = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/.exec(value);
  if (!m) throw new Error(`not an HSL channel triple: ${value}`);
  const h = Number(m[1]);
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

function luminance(value: string): number {
  const [r, g, b] = rgb(value).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const colourTokens = [
  'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground', 'primary',
  'primary-foreground', 'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent',
  'accent-foreground', 'destructive', 'destructive-foreground', 'border', 'input', 'ring',
  'sidebar-background', 'sidebar-foreground', 'sidebar-primary', 'sidebar-primary-foreground',
  'sidebar-accent', 'sidebar-accent-foreground', 'sidebar-border', 'sidebar-ring',
  'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5',
  'status-ok', 'status-ok-foreground', 'status-warning', 'status-warning-foreground',
  'status-over', 'status-over-foreground',
];

describe('SPEC-010 Enabler-002 components.json', () => {
  it('SPEC-010 T-006 records the style, the aliases, the css path and lucide', () => {
    const cfg = JSON.parse(read('components.json')) as {
      style: string;
      tailwind: { css: string; config: string; cssVariables: boolean };
      aliases: Record<string, string>;
      iconLibrary: string;
    };
    expect(cfg.style).toBeTruthy();
    expect(cfg.aliases).toMatchObject({
      components: '@/components',
      ui: '@/components/ui',
      lib: '@/lib',
      hooks: '@/hooks',
    });
    expect(cfg.tailwind.css).toBe('src/index.css');
    expect(cfg.tailwind.config).toBe('tailwind.config.ts');
    expect(cfg.tailwind.cssVariables).toBe(true);
    expect(cfg.iconLibrary).toBe('lucide');
  });
});

describe('SPEC-010 Enabler-002 tokens', () => {
  it('SPEC-010 T-007 defines every token in a light block and a dark prefers-color-scheme block', () => {
    expect(darkStart).toBeGreaterThan(-1);
    const darkOnly = declarations(darkBody);
    for (const name of colourTokens) {
      expect(light[name], `light --${name}`).toBeTruthy();
      expect(darkOnly[name], `dark --${name}`).toBeTruthy();
    }
    expect(light.radius).toBeTruthy();
  });

  it('SPEC-010 T-007 has a :focus-visible ring and no toggle, class switch or storage', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid hsl\(var\(--ring\)\)/);
    const stored = ['local', 'session'].map((p) => `${p}Storage`);
    for (const forbidden of [...stored, 'document.cookie', 'theme-toggle', '.dark ', 'class="dark"']) {
      expect(css).not.toContain(forbidden);
    }
    expect(css).toContain('@tailwind utilities');
  });

  it('SPEC-010 T-007 tailwind.config.ts uses darkMode media and the animate plugin', () => {
    expect(tailwindConfig.darkMode).toBe('media');
    expect(tailwindConfig.plugins?.length ?? 0).toBeGreaterThan(0);
    expect(read('tailwind.config.ts')).toContain("from 'tailwindcss-animate'");
    const colors = JSON.stringify(tailwindConfig.theme?.extend?.colors);
    for (const n of ['status', 'sidebar', 'chart', 'destructive', 'ring']) expect(colors).toContain(n);
  });
});

describe('SPEC-010 Enabler-002 contrast', () => {
  const textPairs: [string, string][] = [
    ['foreground', 'background'],
    ['card-foreground', 'card'],
    ['popover-foreground', 'popover'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'muted'],
    ['muted-foreground', 'card'],
    ['primary-foreground', 'primary'],
    ['secondary-foreground', 'secondary'],
    ['accent-foreground', 'accent'],
    ['destructive-foreground', 'destructive'],
    ['destructive', 'background'],
    ['destructive', 'card'],
    ['status-ok-foreground', 'status-ok'],
    ['status-warning-foreground', 'status-warning'],
    ['status-over-foreground', 'status-over'],
    ['sidebar-foreground', 'sidebar-background'],
    ['sidebar-primary-foreground', 'sidebar-primary'],
    ['sidebar-accent-foreground', 'sidebar-accent'],
  ];
  const graphicPairs: [string, string][] = [
    ['ring', 'background'],
    ['ring', 'card'],
    ['border', 'background'],
    ['border', 'card'],
    ['input', 'background'],
    ['sidebar-border', 'sidebar-background'],
    ['sidebar-ring', 'sidebar-background'],
    ['status-ok', 'card'],
    ['status-warning', 'card'],
    ['status-over', 'card'],
    ['chart-1', 'card'],
    ['chart-2', 'card'],
    ['chart-3', 'card'],
    ['chart-4', 'card'],
    ['chart-5', 'card'],
  ];

  for (const [scheme, tokens] of [['light', light], ['dark', dark]] as const) {
    it(`SPEC-010 T-008 text pairs reach 4.5:1 in the ${scheme} scheme`, () => {
      for (const [fg, bg] of textPairs) {
        expect(contrast(tokens[fg] as string, tokens[bg] as string), `${scheme} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`SPEC-010 T-008 ring, border and graphic pairs reach 3:1 in the ${scheme} scheme`, () => {
      for (const [fg, bg] of graphicPairs) {
        expect(contrast(tokens[fg] as string, tokens[bg] as string), `${scheme} ${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it('SPEC-010 T-008 the contrast maths is not vacuous', () => {
    expect(contrast('0 0% 0%', '0 0% 100%')).toBeCloseTo(21, 0);
    expect(contrast('0 0% 100%', '0 0% 100%')).toBeCloseTo(1, 5);
    expect(contrast('0 0% 60%', '0 0% 100%')).toBeLessThan(4.5);
  });
});

describe('SPEC-010 Enabler-002 build configuration', () => {
  it('SPEC-010 T-013 every config file the Dockerfile COPYs exists', () => {
    const copy = /^COPY (web\/components\.json[^\n]*) web\/$/m.exec(read('Dockerfile'));
    expect(copy).not.toBeNull();
    const files = (copy as RegExpExecArray)[1]!.split(/\s+/).map((f) => f.replace(/^web\//, ''));
    expect(files).toEqual(['components.json', 'tailwind.config.ts', 'postcss.config.js']);
    for (const file of files) expect(existsSync(resolve(webRoot, file)), file).toBe(true);
  });

  it('SPEC-010 T-013 postcss.config.js lists tailwindcss and autoprefixer', () => {
    const postcss = read('postcss.config.js');
    expect(postcss).toMatch(/tailwindcss:\s*\{\}/);
    expect(postcss).toMatch(/autoprefixer:\s*\{\}/);
  });

  it('SPEC-010 T-013 content covers src/**/*.{ts,tsx}', () => {
    expect(tailwindConfig.content).toContain('./src/**/*.{ts,tsx}');
  });
});
