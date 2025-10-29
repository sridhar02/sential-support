FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
RUN npm install --workspace web
COPY web ./web
RUN npm run build --workspace web

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/web/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
