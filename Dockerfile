# syntax=docker/dockerfile:1

FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# Vite inlines this at build time. Pass it as:
# docker build --build-arg VITE_API_URL=https://api.example.com/api -t travelcrm-frontend .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN if [ -z "$VITE_API_URL" ]; then \
      echo "VITE_API_URL build arg is required and must end with /api" >&2; \
      exit 1; \
    fi; \
    case "$VITE_API_URL" in \
      */api) ;; \
      *) echo "VITE_API_URL must end with /api" >&2; exit 1 ;; \
    esac; \
    npm run build

FROM nginx:stable-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
