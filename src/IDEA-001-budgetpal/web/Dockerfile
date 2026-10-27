# BudgetPal web image. Build context is the workspace root (src/IDEA-001-budgetpal):
#   docker build -f web/Dockerfile .
# Vite runs in the build stage; the runtime stage is nginx serving the static
# bundle as a non-root user.

# ---- build: pinned Node, pnpm, Vite bundle
FROM node:22-bookworm-slim AS build
RUN npm install -g pnpm@12.11.2
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN pnpm install --frozen-lockfile --filter @budgetpal/web...
COPY web/tsconfig.json web/vite.config.ts web/index.html web/
COPY web/src web/src
RUN pnpm --filter @budgetpal/web build

# ---- runtime: pinned unprivileged nginx
FROM nginxinc/nginx-unprivileged:1.27.5-alpine AS runtime
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD ["wget", "--quiet", "--spider", "http://127.0.0.1:8080/"]
