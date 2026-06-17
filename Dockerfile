# Multi-stage Dockerfile for both Development and Production
FROM node:18-alpine AS base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "src/index.js"]
