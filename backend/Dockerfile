# Use industry-standard Node.js base image
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy dependency definition files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy all source files into the container
COPY . .

# Expose backend API port
EXPOSE 3000

# Set healthcheck
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/scan-progress || exit 1

# Start the application
CMD ["node", "server.js"]
