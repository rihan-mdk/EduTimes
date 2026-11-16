# =======================================================
# Production Dockerfile for EduTimes / YenSync Backend API
# Multi-stage, minimal attack surface, non-root execution
# =======================================================

# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package descriptors
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts

# Stage 2: Minimal Production Runtime
FROM node:20-alpine

# Set secure environment variables
ENV NODE_ENV=production
ENV PORT=5000

WORKDIR /usr/src/app

# Install dumb-init to properly handle PID 1 signals (SIGTERM/SIGINT) in containers
RUN apk add --no-cache dumb-init

# Copy node_modules from builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY package*.json ./

# Copy application source and migrations
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY scripts/ ./scripts/

# Run as unprivileged node user (CIS Docker Benchmark recommendation)
USER node

EXPOSE 5000

# Healthcheck for container orchestrators (Docker Swarm, ECS, Cloud Run, Kubernetes)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start container with dumb-init for graceful signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "src/server.js"]
