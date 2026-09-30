FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Prisma generation needs a syntactically valid URL, not a live database.
RUN DIRECT_URL=postgresql://build:build@localhost:5432/build DATABASE_URL=postgresql://build:build@localhost:5432/build npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["npm", "start"]
