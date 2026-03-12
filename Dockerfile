# Use Node.js 20 as the base image
FROM node:20-slim

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for the build step)
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Vite application
RUN npm run build

# Set the port environment variable (Cloud Run defaults to 8080)
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Start the application
CMD ["node", "server.js"]
