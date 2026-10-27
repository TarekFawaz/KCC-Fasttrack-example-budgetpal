# BudgetPal api image. Build context is the workspace root (src/IDEA-001-budgetpal):
#   docker build -f api/Dockerfile .
# The native toolchain (python3, make, g++) lives in the build stages only; the
# runtime stage carries compiled output and production dependencies.
# Every stage starts from the pinned external base (GR-017 / SR-018: no stage
# reference after FROM). The two build stages repeat the same toolchain steps;
# identical instructions on the same parent hit the Docker build cache, so the
# toolchain layers are built once.

# ---- build: pinned base, pnpm, native build tools for better-sqlite3,
#      all api dependencies, TypeScript compiled to dist/
FROM node:22-bookworm-slim AS build
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@12.11.2
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile --filter @budgetpal/api...
COPY api/tsconfig.json api/tsconfig.json
COPY api/src api/src
RUN pnpm --filter @budgetpal/api build

# ---- prod-deps: same toolchain, production dependencies only (better-sqlite3 compiled here)
FROM node:22-bookworm-slim AS prod-deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@12.11.2
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile --prod --filter @budgetpal/api...

# ---- runtime: no toolchain, non-root
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/data/budgetpal.db
WORKDIR /app/api
COPY --from=prod-deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=node:node /app/api/node_modules ./node_modules
COPY --chown=node:node api/package.json ./package.json
COPY --from=build --chown=node:node /app/api/dist ./dist
COPY --chown=node:node api/migrations ./migrations
# tsc does not copy non-TypeScript files: the bundled common-password list sits beside its module.
COPY --chown=node:node api/src/modules/auth/common-passwords.txt ./dist/modules/auth/common-passwords.txt
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/server.js"]
