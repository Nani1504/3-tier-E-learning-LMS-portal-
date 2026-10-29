# ---- build stage: compile the Vite app ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# ---- runtime stage: serve static files with nginx (non-root) ----
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
# Default backend target; override via env in compose / k8s.
ENV BACKEND_URL=http://backend:4000

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

# The unprivileged image already runs as UID 101 (nginx) and listens on 8080.
# nginx's entrypoint runs envsubst over /etc/nginx/templates/*.template,
# substituting ${BACKEND_URL} into the final config.
EXPOSE 8080
