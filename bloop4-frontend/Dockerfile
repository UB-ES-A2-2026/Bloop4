# syntax=docker/dockerfile:1
# Genera els estàtics de Vite a /app/dist la direcció que concretem
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Els test i run de Vite
RUN npm test && npm run build 

# Copia els resultats de la compilació a dist per a posar-els a al fitxer de configuració de nginx
FROM nginx:1.30-alpine
# Les imatges oficials porten paquets amb vulnerabilitats crítiques que ja tenen solució
RUN apk upgrade --no-cache
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
