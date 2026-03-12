# Use Node.js 20 as the base image
FROM node:20-slim

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Vite application
RUN npm run build

# Expose the port the app runs on (Cloud Run uses PORT env var, but 3000 is our default)
EXPOSE 3000

# Start the application using the start script in package.json
CMD ["npm", "start"]
