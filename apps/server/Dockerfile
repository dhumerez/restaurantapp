FROM node:22-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune @restaurant/server --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM installer AS runner
WORKDIR /app
COPY --from=builder /app/out/full/ .
RUN pnpm turbo build --filter=@restaurant/server
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
