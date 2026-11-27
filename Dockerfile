# CRM Román Portela.
# El frontend viene YA COMPILADO en backend/publico, así que el servidor no
# tiene que construir nada: sólo baja cuatro paquetes de JavaScript puro.
# Esto hace que el deploy use muy poca memoria y termine en segundos.
# Para recompilar el frontend (sólo si tocás src/): cd frontend && npm install && npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY backend/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY backend/ ./

EXPOSE 3000
CMD ["node", "server.js"]
