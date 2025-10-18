# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Install utilities: ping, sqlite3 for database access, and libcap for capabilities
RUN apk add --no-cache iputils libcap sqlite

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm install
RUN cd server && npm install

# Install serve globally for production
RUN npm install -g serve

# Copy source code
COPY . .

# Build the React app
RUN npm run build

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S piman -u 1001


# Change ownership of specific files only (excluding node_modules)
RUN chown piman:nodejs /app/server/server.js
RUN chown piman:nodejs /app/server/package*.json
RUN chown -R piman:nodejs /app/server/utils
RUN chown -R piman:nodejs /app/build
RUN chown -R piman:nodejs /app/public
RUN chown -R piman:nodejs /app/src
RUN chown piman:nodejs /app/package*.json
# Create logs and data directories with proper ownership
RUN mkdir -p /app/server/logs /app/data && \
    chown -R piman:nodejs /app/server/logs /app/data && \
    chown piman:nodejs /app/server

# Set capabilities on ping to allow non-root users to use it
RUN setcap cap_net_raw+ep /bin/ping || true

USER piman

# Expose ports
EXPOSE 3000 3001

# Start the application directly
CMD ["sh", "-c", "cd /app/server && node server.js & cd /app && serve -s build -l 3000"]
