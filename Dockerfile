# Use official Node.js LTS image
FROM node:20-alpine

# Install ffmpeg and python for yt-dlp/youtube-dl support
RUN apk add --no-cache ffmpeg python3 py3-pip

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Cloud Run uses PORT env variable
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "server.js"]