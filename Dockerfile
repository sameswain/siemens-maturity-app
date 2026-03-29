FROM node:18-alpine

# Install build tools needed to compile better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install and build frontend
COPY frontend/package*.json ./frontend/
RUN npm install --prefix frontend
COPY frontend/ ./frontend/
RUN npm run build --prefix frontend

# Install backend dependencies (compiles better-sqlite3 for Linux)
COPY backend/package*.json ./backend/
RUN npm install --prefix backend
COPY backend/src/ ./backend/src/

EXPOSE 8000

CMD ["node", "backend/src/index.js"]
