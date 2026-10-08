# Production Multi-Stage Dockerfile for India Disaster Management Backend API
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Final runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Non-root user for security
USER node

COPY --chown=node:node --from=builder /app /app

EXPOSE 5000

CMD ["node", "src/server.js"]
