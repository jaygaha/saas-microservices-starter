# syntax=docker/dockerfile:1

# Shared deps
FROM node:24-alpine AS deps
WORKDIR /www/web-service

COPY package*.json ./
RUN npm ci


# DEV (Vite+HMR)
FROM node:24-alpine AS dev
WORKDIR /www/web-service

COPY --from=deps /www/web-service/node_modules ./node_modules
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# BUILD
FROM deps AS builder

COPY . .

ARG VITE_APP_TITLE="Task Manager SaaS"
ENV VITE_APP_TITLE=$VITE_APP_TITLE

RUN npm run build

# SERVE (PRD)
FROM nginx:1.27-alpine AS prod

COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /www/web-service/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
