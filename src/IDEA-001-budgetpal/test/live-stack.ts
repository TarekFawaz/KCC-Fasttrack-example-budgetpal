import { spawnSync } from 'node:child_process';

/**
 * Decides whether the Docker live-stack tests (packaging.test.ts: T-031, T-034, T-035) can prove anything here.
 * A running daemon is not enough:
 *  - the web image build runs `npm install -g pnpm@...` inside a build container, so that container must be able
 *    to reach the npm registry (offline, or a TLS-intercepting proxy, make it fail);
 *  - `docker compose up` creates a project network, so the daemon must still be able to allocate one (a host that
 *    has accumulated many stacks runs out of address pools: "all predefined address pools have been fully subnetted").
 * When either is missing, the suite is skipped with a reason and reported as deferred, never as passed.
 */

export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export type Runner = (command: string, args: string[], timeoutMs: number) => RunResult;

export interface LiveStackProbe {
  /** `docker compose` is installed. */
  cli: boolean;
  /** A Docker daemon answers `docker info`. */
  daemon: boolean;
  /** A build container reached the npm registry; null when it was not probed. */
  registry: boolean | null;
  /** The daemon created (and removed) a throwaway network, as `compose up` must; null when it was not probed. */
  network: boolean | null;
  /** Why the live stack cannot run here; null when it can. */
  skipReason: string | null;
}

const defaultRunner: Runner = (command, args, timeoutMs) => {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: timeoutMs });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr || (result.error ? result.error.message : ''),
  };
};

/** Set to `1` (or `true`) to run the Docker live-stack tests; without it they are deferred. */
export const LIVE_STACK_ENV = 'BUDGETPAL_LIVE_STACK';

/**
 * Human decision H-001: the Docker steps that need a registry, a free network and the fixed host ports 3000 and 8080
 * (compose up, the containers, the smoke checks) are an accepted deferral, never a pass. They also cannot be trusted
 * on a shared daemon: parallel lanes use the same compose project name and the same ports, so a stack started in one
 * lane starves the others (services never turn healthy and the suite fails after the 180 s wait). The live stack is
 * therefore opt-in. Returns why it is deferred, or null when the environment opts in.
 */
export function liveStackDeferral(env: Record<string, string | undefined>): string | null {
  const value = (env[LIVE_STACK_ENV] ?? '').trim().toLowerCase();
  if (value === '1' || value === 'true') return null;
  return `accepted-deferred by human decision H-001 (docker compose up, containers and smoke checks are not run; set ${LIVE_STACK_ENV}=1 to run them)`;
}

/** `docker compose` is installed. Asks nothing of the daemon, the registry or the network. */
export function composeCliAvailable(run: Runner = defaultRunner): boolean {
  return run('docker', ['compose', 'version'], 20_000).status === 0;
}

/** The base image of the first stage and the package spec of its first `npm install -g`, or null if none. */
export function buildProbe(dockerfile: string): { image: string; spec: string } | null {
  const image = dockerfile.match(/^FROM\s+(?:--\S+\s+)*(\S+)/m)?.[1];
  const spec = dockerfile.match(/^RUN\s+npm\s+install\s+-g\s+(\S+)/m)?.[1];
  return image && spec ? { image, spec } : null;
}

/** First line that says what went wrong, for the skip reason. */
function detail(result: RunResult): string {
  if (result.status === null) return 'timed out or no exit status';
  const lines = result.stderr.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const code = lines.find((line) => /^npm error code\s/.test(line));
  return code ? code.replace(/^npm error code\s+/, '') : (lines[0] ?? `exit ${result.status}`);
}

/**
 * Creates and removes a throwaway network, which is what `compose up` needs first. Returns null when it works,
 * otherwise the first line of what the daemon said. A failed removal is not a failure of the probe: the network
 * only costs an address pool until the next `docker network prune`, and the probe has already proved its point.
 */
function networkFailure(run: Runner): string | null {
  const name = `budgetpal-probe-${process.pid}-${Date.now()}`;
  const created = run('docker', ['network', 'create', name], 30_000);
  if (created.status !== 0) return detail(created);
  run('docker', ['network', 'rm', name], 30_000);
  return null;
}

export function probeLiveStack(dockerfile: string, run: Runner = defaultRunner): LiveStackProbe {
  if (!composeCliAvailable(run)) {
    return { cli: false, daemon: false, registry: null, network: null, skipReason: 'docker compose is not installed' };
  }
  if (run('docker', ['info'], 20_000).status !== 0) {
    return { cli: true, daemon: false, registry: null, network: null, skipReason: 'no Docker daemon answers' };
  }

  let registry: boolean | null = null;
  const build = buildProbe(dockerfile);
  if (build) {
    // Same client and same package the Dockerfile uses; no retries so an offline registry fails fast.
    const result = run(
      'docker',
      ['run', '--rm', build.image, 'npm', 'view', build.spec, 'version', '--fetch-retries=0', '--fetch-timeout=15000'],
      120_000,
    );
    if (result.status !== 0) {
      return {
        cli: true,
        daemon: true,
        registry: false,
        network: null,
        skipReason: `the build container cannot reach the npm registry (npm view ${build.spec} in ${build.image}: ${detail(result)})`,
      };
    }
    registry = true;
  }

  const failure = networkFailure(run);
  if (failure !== null) {
    return {
      cli: true,
      daemon: true,
      registry,
      network: false,
      skipReason: `the Docker daemon cannot create the compose network (docker network create: ${failure})`,
    };
  }
  return { cli: true, daemon: true, registry, network: true, skipReason: null };
}
