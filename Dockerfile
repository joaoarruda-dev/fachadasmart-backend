# Backend do Fachada Smart para o Google Cloud Run
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# O Cloud Run define PORT (padrão 8080); o server.ts já lê process.env.PORT
EXPOSE 8080
USER node
CMD ["node", "dist/server.js"]
