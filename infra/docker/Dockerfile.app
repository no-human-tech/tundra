# Tundra app image — jeden obraz dla wszystkich ról (ADR-0016): API (GraphQL
# Yoga na Hono), worker (BullMQ) i web (statyczny frontend Vite serwowany przez
# Node — apps/web/server.ts). Rolę wybiera `command` w manifeście/compose:
#
#   api    (domyślny CMD): pnpm --filter @tundra/api start
#   worker:                pnpm --filter @tundra/worker start
#   web:                   pnpm --filter @tundra/web run serve
#
# Build context MUSI być rootem repo:
#   docker build -f infra/docker/Dockerfile.app --build-arg VITE_API_URL=... -t tundra-app .
#
# Aplikacje działają przez `tsx` (bez kompilacji do dist); pakiety workspace są
# konsumowane jako źródła TypeScript. VITE_* są wlutowywane w bundel frontendu
# w czasie BUDOWY (Vite podmienia import.meta.env statycznie).

# ----- Etap 1: instalacja zależności workspace (cache na manifestach) -----
FROM node:20-alpine AS deps
WORKDIR /app

# Corepack jest w Node 20 i przypina pnpm z "packageManager" w package.json.
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/modules-sdk/package.json packages/modules-sdk/package.json
COPY packages/test-utils/package.json packages/test-utils/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile

# ----- Etap 2: źródła + bramki typów + build frontendu -----
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
# Zainstalowany workspace (root ORAZ per-pakietowe node_modules) z etapu deps,
# nałożone źródła. .dockerignore trzyma hostowe node_modules poza kontekstem.
COPY --from=deps /app ./
COPY . .

# VITE_* dla frontendu — patrz komentarze w infra/compose/docker-compose.yml.
ARG VITE_API_URL=http://localhost:4000/graphql
ENV VITE_API_URL=${VITE_API_URL}
ARG VITE_GITHUB_CLIENT_ID=
ENV VITE_GITHUB_CLIENT_ID=${VITE_GITHUB_CLIENT_ID}
ARG VITE_GITLAB_CLIENT_ID=
ENV VITE_GITLAB_CLIENT_ID=${VITE_GITLAB_CLIENT_ID}
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
ARG VITE_APPLE_CLIENT_ID=
ENV VITE_APPLE_CLIENT_ID=${VITE_APPLE_CLIENT_ID}
ARG VITE_OIDC_ENABLED=
ENV VITE_OIDC_ENABLED=${VITE_OIDC_ENABLED}

# Bramki budowy: typecheck API i workera, pełny build frontendu (vite build
# emituje apps/web/dist, które serwuje apps/web/server.ts).
RUN pnpm --filter @tundra/api run build \
	&& pnpm --filter @tundra/worker run build \
	&& pnpm --filter @tundra/web run build

# ----- Etap 3: runtime -----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

COPY --from=build /app ./

# Nieuprzywilejowany user node z obrazu bazowego.
USER node

# 4000 = API, 8080 = web (server.ts); worker nie otwiera portów.
EXPOSE 4000 8080

CMD ["pnpm", "--filter", "@tundra/api", "start"]
