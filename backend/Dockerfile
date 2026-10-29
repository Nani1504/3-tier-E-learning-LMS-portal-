# ---- deps stage: install production dependencies only ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# ---- runtime stage ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as the built-in unprivileged "node" user, not root.
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Video storage root. In Kubernetes an EFS volume is mounted here; in
# docker-compose a named volume inherits this ownership so "node" can write.
RUN mkdir -p /data/videos && chown -R node:node /data
ENV VIDEO_DATA_DIR=/data/videos

USER node
EXPOSE 4000
CMD ["node", "src/index.js"]
