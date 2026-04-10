# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY src/package.json src/package-lock.json ./
RUN npm ci
COPY src/ .
RUN npm run build

# Stage 2: Serve
FROM nginx:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
