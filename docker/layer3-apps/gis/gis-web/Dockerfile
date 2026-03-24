# -- Build stage --
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ARG VITE_API_BASE_URL=/api
ARG VITE_TILE_BASE_URL=/tiles
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_TILE_BASE_URL=${VITE_TILE_BASE_URL}

RUN npm run build

# -- Serve stage --
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
