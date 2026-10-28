# syntax=docker/dockerfile:1
# Viewer réseau/pairs Holochain (lecture seule, API admin).
FROM --platform=linux/amd64 node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY server.mjs ./
COPY public ./public
EXPOSE 4001
CMD ["node", "server.mjs"]
