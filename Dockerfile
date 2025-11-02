FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first to leverage caching
COPY package*.json ./

# Install all dependencies (dev and production)
RUN npm ci

# Copy the entire source code
COPY . .

# Run the build process (compiles to dist/ folder)
RUN npm run build


FROM node:20-alpine AS production

# Set the working directory for the runtime
WORKDIR /app

# Copy ONLY production dependencies from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy only the compiled JavaScript files and necessary package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nestjs -u 1001 && \
  chown -R nestjs:nodejs /app

# Switch to non-root user for execution
USER nestjs

# Expose application port
EXPOSE 3000

# Health check
# Note: The healthcheck in docker-compose is usually preferred, 
# but keeping this here for completeness in the Dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "dist/main.js"]