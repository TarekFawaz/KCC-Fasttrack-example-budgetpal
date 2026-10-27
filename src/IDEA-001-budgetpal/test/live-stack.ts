import { spawnSync } from 'node:child_process';

/**
 * Decides whether the Docker live-stack tests (packaging.test.ts: T-031, T-034, T-035) can prove anything here.
 * A running daemon is not enough: the web image build runs `npm install -g pnpm@...` inside a build container,
 * so that container must be able to reach the npm registry. When it cannot (offline, or a TLS-intercepting
 * proxy), the suite is skipped with a reason and reported as deferred, never as passed.
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

export function probeLiveStack(dockerfile: string, run: Runner = defaultRunner): LiveStackProbe {
  if (run('docker', ['compose', 'version'], 20_000).status !== 0) {
    return { cli: false, daemon: false, registry: null, skipReason: 'docker compose is not installed' };
  }
  if (run('docker', ['info'], 20_000).status !== 0) {
    return { cli: true, daemon: false, registry: null, skipReason: 'no Docker daemon answers' };
  }
  const build = buildProbe(dockerfile);
  if (!build) return { cli: true, daemon: true, registry: null, skipReason: null };

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
      skipReason: `the build container cannot reach the npm registry (npm view ${build.spec} in ${build.image}: ${detail(result)})`,
    };
  }
  return { cli: true, daemon: true, registry: true, skipReason: null };
}
