# syntax=docker/dockerfile:1
# Serveur HTTP GraphQL hREA (sidecar). Les deps sont figees dans l'image.
FROM --platform=linux/amd64 node:20-slim

WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY server.mjs ./
COPY public ./public

EXPOSE 4000
CMD ["node", "server.mjs"]
