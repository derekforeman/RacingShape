# syntax=docker/dockerfile:1
#
# RacingShape — single-image deploy (API serves the built web bundle).
# Multi-stage: compile shared + api (native better-sqlite3) + web, then ship a
# lean runtime with only Node, the pruned dependency tree, and built artifacts.

# ---- Build stage --------------------------------------------------------------
FROM node:26-bookworm-slim AS builder
WORKDIR /app

# Toolchain for better-sqlite3's native binding (compiled, since Node 26 prebuilds
# may not exist). Removed from the final image — runtime needs none of it.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install with only the workspace manifests first, for better layer caching.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY web/package.json web/
RUN npm ci

# Sources, then build all three workspaces (shared → api → web).
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY api/ api/
COPY web/ web/
RUN npm run build -w @racingshape/shared \
 && npm run build -w @racingshape/api \
 && npm run build -w @racingshape/web

# Drop devDeps (vite, tsc, vitest…); keeps the compiled better-sqlite3 binding.
RUN npm prune --omit=dev

# ---- Runtime stage ------------------------------------------------------------
FROM node:26-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Pruned dependency tree (incl. native better-sqlite3) + the workspace symlinks.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# shared: the @racingshape/shared symlink in node_modules resolves to ./shared.
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist

# api: the server entrypoint.
COPY --from=builder /app/api/package.json ./api/package.json
COPY --from=builder /app/api/dist ./api/dist

# web: the static bundle Express serves (see DEPLOY.md for the WEB_DIST wiring).
COPY --from=builder /app/web/dist ./web/dist

# SQLite file lives on the mounted volume, not the image.
RUN mkdir -p /data
EXPOSE 8787
CMD ["node", "api/dist/index.js"]
