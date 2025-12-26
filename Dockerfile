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

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
