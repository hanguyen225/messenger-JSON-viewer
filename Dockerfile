# Multi-stage build for Next.js
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN yarn build

# Production stage
FROM node:18-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache dumb-init
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Run app
ENTRYPOINT ["dumb-init", "--"]
CMD ["yarn", "start"]
