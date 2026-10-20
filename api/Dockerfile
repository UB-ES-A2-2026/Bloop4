# syntax=docker/dockerfile:1
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Esta copiant la informació de configruació dels dos json que te el repo
COPY package.json package-lock.json ./
# Busquem instalar noomés les depenèndies necessaries
RUN npm ci --omit=dev && npm cache clean --force 

COPY src ./src

USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
