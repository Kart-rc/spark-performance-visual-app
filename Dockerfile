FROM node:22-alpine AS build

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci

COPY . .

# Build-time configuration for OpenTelemetry exporters
ARG VITE_ENABLE_OTLP=true
ARG VITE_OTLP_ENDPOINT=http://tempo:4318/v1/traces
ARG VITE_ENABLE_JAEGER=false
ENV VITE_ENABLE_OTLP=${VITE_ENABLE_OTLP}
ENV VITE_OTLP_ENDPOINT=${VITE_OTLP_ENDPOINT}
ENV VITE_ENABLE_JAEGER=${VITE_ENABLE_JAEGER}

RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server.js .

EXPOSE 3000

CMD ["node", "server.js"]
