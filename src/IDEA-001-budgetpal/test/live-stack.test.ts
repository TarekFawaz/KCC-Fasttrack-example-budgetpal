import { describe, expect, it } from 'vitest';
import { buildProbe, probeLiveStack, type RunResult, type Runner } from './live-stack.js';

/**
 * Gate for the Docker live-stack tests in packaging.test.ts (T-031, T-034, T-035).
 * They can only prove anything when a daemon answers, a build container can reach the npm registry
 * (web/Dockerfile runs `npm install -g pnpm@...`) AND the daemon can create the compose network (it can run out of
 * address pools when many other stacks leave networks behind). Otherwise they are skipped and reported as deferred.
 * The runner is injected, so these tests never start Docker.
 */

const dockerfile = [
  '# comment',
  'FROM node:22-bookworm-slim AS build',
  'RUN npm install -g pnpm@12.11.2',
  'WORKDIR /app',
  'FROM nginx:1.27-alpine',
  'COPY --from=build /app/web/dist /usr/share/nginx/html',
  '',
].join('\n');

const ok: RunResult = { status: 0, stdout: '', stderr: '' };
const tlsFailure: RunResult = {
  status: 1,
  stdout: '',
  stderr:
    'npm error code UNABLE_TO_VERIFY_LEAF_SIGNATURE\nnpm error request to https://registry.npmjs.org/pnpm failed\n',
};

const poolsExhausted: RunResult = {
  status: 1,
  stdout: '',
  stderr: 'Error response from daemon: all predefined address pools have been fully subnetted\n',
};

/** Fake docker: answers by subcommand and records every call. */
function fakeDocker(answers: { compose?: RunResult; info?: RunResult; run?: RunResult; network?: RunResult }) {
  const calls: string[][] = [];
  const run: Runner = (command, args) => {
    calls.push([command, ...args]);
    const sub =
      args[0] === 'compose' ? 'compose' : args[0] === 'info' ? 'info' : args[0] === 'network' ? 'network' : 'run';
    return answers[sub] ?? ok;
  };
  return { run, calls };
}

const networkCalls = (calls: string[][]): string[][] => calls.filter((call) => call[1] === 'network');

describe('live-stack gate: buildProbe', () => {
  it('reads the first base image and the first global npm install', () => {
    expect(buildProbe(dockerfile)).toEqual({ image: 'node:22-bookworm-slim', spec: 'pnpm@12.11.2' });
  });

  it('skips a --platform flag on FROM', () => {
    const text = 'FROM --platform=linux/amd64 node:22-bookworm-slim\nRUN npm install -g pnpm@9\n';
    expect(buildProbe(text)).toEqual({ image: 'node:22-bookworm-slim', spec: 'pnpm@9' });
  });

  it('returns null when the Dockerfile downloads nothing with npm', () => {
    expect(buildProbe('FROM nginx:1.27-alpine\nCOPY . /usr/share/nginx/html\n')).toBeNull();
  });
});

describe('live-stack gate: probeLiveStack', () => {
  it('skips with a reason when docker compose is not installed, and asks nothing else', () => {
    const docker = fakeDocker({ compose: { status: null, stdout: '', stderr: 'spawn docker ENOENT' } });
    const probe = probeLiveStack(dockerfile, docker.run);
    expect(probe.cli).toBe(false);
    expect(probe.daemon).toBe(false);
    expect(probe.skipReason).toMatch(/docker compose/i);
    expect(docker.calls).toHaveLength(1);
  });

  it('skips with a reason when no daemon answers, without probing the registry', () => {
    const docker = fakeDocker({ info: { status: 1, stdout: '', stderr: 'cannot connect' } });
    const probe = probeLiveStack(dockerfile, docker.run);
    expect(probe.cli).toBe(true);
    expect(probe.daemon).toBe(false);
    expect(probe.registry).toBeNull();
    expect(probe.network).toBeNull();
    expect(probe.skipReason).toMatch(/daemon/i);
    expect(docker.calls.some((call) => call[1] === 'run')).toBe(false);
    expect(networkCalls(docker.calls)).toHaveLength(0);
  });

  it('skips and names the npm registry when the build container cannot reach it', () => {
    const docker = fakeDocker({ run: tlsFailure });
    const probe = probeLiveStack(dockerfile, docker.run);
    expect(probe.daemon).toBe(true);
    expect(probe.registry).toBe(false);
    expect(probe.skipReason).toMatch(/npm registry/i);
    expect(probe.skipReason).toContain('pnpm@12.11.2');
    expect(probe.skipReason).toContain('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    expect(probe.network).toBeNull();
    expect(networkCalls(docker.calls)).toHaveLength(0);
  });

  it('runs the very command the Dockerfile needs, in the Dockerfile base image, with no retries', () => {
    const docker = fakeDocker({});
    probeLiveStack(dockerfile, docker.run);
    const probeCall = docker.calls.find((call) => call[1] === 'run');
    expect(probeCall).toBeDefined();
    expect(probeCall).toContain('node:22-bookworm-slim');
    expect(probeCall!.join(' ')).toContain('npm view pnpm@12.11.2 version');
    expect(probeCall).toContain('--fetch-retries=0');
  });

  it('treats a timed-out probe as unreachable', () => {
    const docker = fakeDocker({ run: { status: null, stdout: '', stderr: '' } });
    const probe = probeLiveStack(dockerfile, docker.run);
    expect(probe.registry).toBe(false);
    expect(probe.skipReason).toMatch(/npm registry/i);
    expect(probe.skipReason).toMatch(/timed out|no exit status/i);
  });

  it('runs the live stack (no skip reason) when the daemon answers, the registry is reachable and a network can be created', () => {
    const probe = probeLiveStack(dockerfile, fakeDocker({}).run);
    expect(probe).toEqual({ cli: true, daemon: true, registry: true, network: true, skipReason: null });
  });

  it('does not probe the registry when the Dockerfile downloads nothing, but still probes the network', () => {
    const docker = fakeDocker({});
    const probe = probeLiveStack('FROM nginx:1.27-alpine\n', docker.run);
    expect(probe.skipReason).toBeNull();
    expect(probe.registry).toBeNull();
    expect(probe.network).toBe(true);
    expect(docker.calls.some((call) => call[1] === 'run')).toBe(false);
    expect(networkCalls(docker.calls).length).toBeGreaterThan(0);
  });
});

describe('live-stack gate: probeLiveStack network capacity', () => {
  it('skips and names the network when the daemon has run out of address pools', () => {
    const docker = fakeDocker({ network: poolsExhausted });
    const probe = probeLiveStack(dockerfile, docker.run);
    expect(probe.cli).toBe(true);
    expect(probe.daemon).toBe(true);
    expect(probe.registry).toBe(true);
    expect(probe.network).toBe(false);
    expect(probe.skipReason).toMatch(/network/i);
    expect(probe.skipReason).toContain('all predefined address pools have been fully subnetted');
  });

  it('skips when the network probe times out', () => {
    const docker = fakeDocker({ network: { status: null, stdout: '', stderr: '' } });
    const probe = probeLiveStack(dockerfile, docker.run);
    expect(probe.network).toBe(false);
    expect(probe.skipReason).toMatch(/network/i);
    expect(probe.skipReason).toMatch(/timed out|no exit status/i);
  });

  it('skips on a network failure even when the Dockerfile downloads nothing', () => {
    const docker = fakeDocker({ network: poolsExhausted });
    const probe = probeLiveStack('FROM nginx:1.27-alpine\n', docker.run);
    expect(probe.registry).toBeNull();
    expect(probe.network).toBe(false);
    expect(probe.skipReason).toMatch(/network/i);
  });

  it('creates a throwaway network and removes the very same one afterwards', () => {
    const docker = fakeDocker({});
    probeLiveStack(dockerfile, docker.run);
    const [create, remove] = networkCalls(docker.calls);
    expect(create?.slice(1, 3)).toEqual(['network', 'create']);
    expect(remove?.slice(1, 3)).toEqual(['network', 'rm']);
    const name = create?.[3];
    expect(name).toMatch(/^budgetpal-probe-/);
    expect(remove?.[3]).toBe(name);
  });

  it('removes nothing when the network could not be created', () => {
    const docker = fakeDocker({ network: poolsExhausted });
    probeLiveStack(dockerfile, docker.run);
    const calls = networkCalls(docker.calls);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[2]).toBe('create');
  });

  it('still reports the live stack as runnable when removing the throwaway network fails', () => {
    const run: Runner = (_command, args) =>
      args[0] === 'network' && args[1] === 'rm' ? { status: 1, stdout: '', stderr: 'not found' } : ok;
    const probe = probeLiveStack(dockerfile, run);
    expect(probe.skipReason).toBeNull();
    expect(probe.network).toBe(true);
  });
});
