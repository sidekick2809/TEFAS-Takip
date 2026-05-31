# Build stage
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Final stage
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --only=production
COPY --from=build /app/dist ./dist
COPY server.js ./
EXPOSE 80
CMD ["node", "server.js"]