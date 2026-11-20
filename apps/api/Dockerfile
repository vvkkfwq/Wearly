FROM node:24-bookworm-slim
ENV NODE_ENV=production
# Preserve the layout used to locate the repository when validating the data directory.
WORKDIR /app/apps/api
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src/ ./src/
COPY migrations/ ./migrations/
USER node
EXPOSE 3000
CMD ["node", "src/index.ts", "production"]
