FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
RUN npm install --workspace api
COPY api ./api
RUN npm run build --workspace api

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/api ./api
RUN npm install --workspace api --omit=dev
WORKDIR /app/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
