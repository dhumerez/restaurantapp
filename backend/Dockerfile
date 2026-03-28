# ── Stage 1: Build ────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ── Stage 2: Production image ──────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only production dependencies (bcrypt needs native build tools)
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
RUN apk del python3 make g++

# Copy compiled output + migration files (SQL, not compiled by tsc)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./dist/db/migrations

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
