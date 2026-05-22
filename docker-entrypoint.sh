#!/bin/sh
set -e

DATA_DIR="/app/data"
SECRETS_FILE="$DATA_DIR/.secrets"
SEED_MARKER="$DATA_DIR/.seeded"

mkdir -p "$DATA_DIR"

# 加载已持久化的密钥
if [ -f "$SECRETS_FILE" ]; then
  . "$SECRETS_FILE"
fi

# JWT_SECRET 为空或仍是占位符时自动生成
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "change-me-to-a-random-jwt-secret-key" ]; then
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  echo "export JWT_SECRET='$JWT_SECRET'" > "$SECRETS_FILE"
  echo "[entrypoint] Generated new JWT_SECRET"
fi

export JWT_SECRET

# 首次启动执行数据库迁移和种子数据
if [ ! -f "$SEED_MARKER" ]; then
  echo "[entrypoint] Syncing database schema..."
  prisma db push
  echo "[entrypoint] Seeding database..."
  tsx prisma/seed.ts
  touch "$SEED_MARKER"
fi

echo "[entrypoint] Starting NovaMind..."
exec node server.js
