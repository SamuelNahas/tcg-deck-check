FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS frontend
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app /app
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--port", "3000", "--hostname", "0.0.0.0"]

FROM node:22-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils tesseract-ocr tesseract-ocr-eng tesseract-ocr-por \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY server ./server
EXPOSE 3001
CMD ["node", "server/server.mjs"]

