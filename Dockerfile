# Use an official Node runtime as a parent image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install Nest CLI globally
RUN npm install -g @nestjs/cli

# Install project dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the Nest.js application
RUN nest build

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start:prod"]
