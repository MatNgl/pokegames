#!/usr/bin/env bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

npm ci
npm run build --workspace=packages/shared-types

docker compose up -d

for i in $(seq 1 30); do
  pg_isready -h localhost -p 5434 -U pokegames -d pokegames_db && break
  sleep 1
done

npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npx prisma generate --schema=apps/api/prisma/schema.prisma

echo "Session pokegames prête."
