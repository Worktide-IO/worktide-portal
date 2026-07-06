# syntax=docker/dockerfile:1
#
# Production image for worktide-portal (Vite/React SPA → static, served by nginx).
# Built by Coolify. Runs at kunden.wappler.systems.
#
# Vite bakes VITE_* at BUILD time. Set in Coolify as a *Build Variable*:
#   VITE_API_BASE=https://api.worktide.wappler.systems/v1

########################
# 1. Build
########################
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

########################
# 2. Serve
########################
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
