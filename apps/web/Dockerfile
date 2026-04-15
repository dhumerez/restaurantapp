FROM node:22-alpine AS base
RUN npm install -g pnpm turbo

FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune @restaurant/web --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

FROM installer AS runner
ARG VITE_API_URL
ARG VITE_VAPID_PUBLIC_KEY
ARG VITE_BASE_PATH=/
COPY --from=builder /app/out/full/ .
RUN pnpm --filter=@restaurant/web build

FROM nginx:alpine
COPY --from=runner /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
