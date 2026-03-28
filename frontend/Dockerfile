# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies fresh — guarantees correct file permissions on binaries
RUN npm ci

# Copy the rest of the source (node_modules and dist are excluded via .dockerignore)
COPY . .

# Type-check and build
RUN npm run build

# Stage 2: serve
FROM nginx:alpine AS runner

# Copy built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
