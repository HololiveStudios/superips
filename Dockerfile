FROM oven/bun:1 AS backend_build
WORKDIR /app/backend

COPY backend/package.json ./
COPY backend/bun.lock ./
RUN bun install

COPY backend ./
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    postgresql-client \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# backend deps
COPY backend/package.json backend/bun.lock ./backend/
RUN bun install --production --frozen-lockfile --cwd ./backend

# copia backend compilado
COPY --from=backend_build /app/backend/dist ./backend/dist
COPY backend ./backend

# copia frontend buildado
COPY dist ./dist

COPY wait-for-postgres.sh /app/wait-for-postgres.sh
RUN chmod +x /app/wait-for-postgres.sh

ENV NODE_ENV=production
ENV DB_HOST=localhost
ENV DB_PORT=5432
ENV DB_USER=superips_user
ENV DB_PASSWORD=359628
ENV DB_NAME=superips_db
ENV JWT_SECRET=TI
ENV JWT_REFRESH_SECRET=TI_REFRESH

EXPOSE 5173

CMD ["/bin/bash", "-c", "/app/wait-for-postgres.sh $DB_HOST $DB_PORT && bun run backend/dist/index.js"]
