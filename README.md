# NovaMind - AI 驱动的在线刷题平台

<p align="center">
  <img src="https://img.shields.io/badge/next.js-15-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/postgresql-16-green" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/redis-7-red" alt="Redis" />
  <img src="https://img.shields.io/badge/docker-ready-blue" alt="Docker" />
</p>

---

## 部署（Docker）

### 前置要求

- Docker >= 20.10
- Docker Compose >= 2.0
- 服务器配置建议：2 核 CPU、4 GB 内存、20 GB 磁盘

### 一键部署

#### 本地部署

```bash
git clone https://github.com/ISHAOHAO/NovaMind.git
cd novamind

# 方法一：本地docker容器部署
docker compose up -d

# 方法二：直接npm启动
npm run dev
```

#### docker compose镜像部署

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    container_name: novamind-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: novamind
      POSTGRES_PASSWORD: novamind_password
      POSTGRES_DB: novamind
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U novamind"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - novamind-network

  redis:
    image: redis:7-alpine
    container_name: novamind-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - novamind-network

  app:
    image: ishaohao/novamind:latest
    container_name: novamind-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://novamind:novamind_password@postgres:5432/novamind?schema=public
      - REDIS_URL=redis://redis:6379
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-http://localhost:3000}
      - NODE_ENV=production
      - SMTP_HOST=${SMTP_HOST:-}
      - SMTP_PORT=${SMTP_PORT:-587}
      - SMTP_USER=${SMTP_USER:-}
      - SMTP_PASS=${SMTP_PASS:-}
      - SMTP_FROM=${SMTP_FROM:-}
      - AI_PROVIDER=${AI_PROVIDER:-openai}
      - AI_API_KEY=${AI_API_KEY:-}
      - AI_MODEL=${AI_MODEL:-gpt-4o-mini}
      - AI_BASE_URL=${AI_BASE_URL:-https://api.openai.com/v1}
    volumes:
      - app_data:/app/data
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - novamind-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  app_data:
    driver: local

networks:
  novamind-network:
    driver: bridge

```

首次启动自动完成：
1. 拉取 PostgreSQL 16 + Redis 7 镜像并启动
2. 构建 NovaMind 应用镜像
3. **自动生成 JWT 签名密钥**（持久化存储，重启不变）
4. **自动执行数据库迁移**
5. **自动填充种子数据**（默认管理员 + 示例题库 + 10 个激活码）

### 访问

打开 http://localhost:3000

### 默认管理员

| 字段 | 值 |
|------|------|
| 邮箱 | `admin@novamind.com` |
| 密码 | `admin123` |

> 首次登录后请立即修改密码。

---

## 自定义配置

部署时通常无需额外配置。如需自定义，在项目目录创建 `.env` 文件（参考 `.env.example`）：

```bash
# 覆盖默认配置（可选）
SMTP_HOST="smtp.qq.com"
SMTP_PORT="587"
SMTP_USER="your-email@qq.com"
SMTP_PASS="your-auth-code"
SMTP_FROM="NovaMind <your-email@qq.com>"

AI_API_KEY="sk-your-openai-key"
```

> SMTP、AI 等配置也可在管理后台 → 系统设置中实时修改，无需重启。

---

## Nginx 反向代理（生产推荐）

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/ssl/certs/your-domain.pem;
    ssl_certificate_key /etc/ssl/private/your-domain.key;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/novamind /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com
```

---

## 运维命令

```bash
docker compose up -d              # 启动所有服务
docker compose down               # 停止并移除容器
docker compose restart app        # 重启应用
docker compose ps                 # 查看容器状态
docker compose logs -f app        # 实时日志
docker compose logs -f postgres   # 数据库日志
docker exec -it novamind-app sh   # 进入应用容器
```

### 数据备份

```bash
# PostgreSQL
docker exec novamind-postgres pg_dump -U novamind novamind > backup_$(date +%Y%m%d).sql

# 恢复
docker exec -i novamind-postgres psql -U novamind novamind < backup.sql
```

---

## 服务架构

```
┌─────────────────────────────────┐
│       Docker Network             │
│                                  │
│  ┌──────────┐ ┌───────┐ ┌────┐  │
│  │ postgres │ │ redis │ │ app│  │
│  │  :5432   │ │ :6379 │ │:3000│  │
│  └──────────┘ └───────┘ └────┘  │
└─────────────────────────────────┘
```

---

## 系统配置

所有系统配置在 **管理后台 → 系统设置** 中实时修改，立即生效：

| 类别 | 可配置项 |
|------|----------|
| 站点 | 名称、描述 |
| 注册 | 开放/关闭、IP/设备限制 |
| 体验版 | 启用/关闭、每日时长 |
| 安全 | 单设备登录、防账号共享、全局限流 |
| AI | 服务商、API Key、模型、每日限额 |
| 邮件 | SMTP 服务器、端口、账号 |

---

## 功能概览

- **五种题型**：单选、多选、判断、填空、完形填空
- **AI 驱动**：题目解析、讲解、相似题、自动出题、批量审查
- **激活码体系**：支持体验版 + 永久/限时激活，批量生成，导出 CSV
- **单设备登录**：WebSocket 实时踢除旧设备，防账号共享
- **题库审核**：用户上传题库需管理员审核后公开
- **文件导入**：支持 JSON / Word / Excel 格式导入题目
- **管理后台**：用户管理、激活码管理、题库审核、操作日志、系统配置
- **风控系统**：IP/设备限流、黑名单、行为异常检测

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| 语言 | TypeScript |
| 样式 | TailwindCSS + shadcn/ui |
| 数据库 | PostgreSQL 16 + Prisma ORM |
| 缓存 | Redis 7 (ioredis) |
| 认证 | JWT + bcryptjs |
| 实时通信 | WebSocket (ws) |
| 邮件 | Nodemailer |
| 部署 | Docker + Docker Compose |

---

## 开发环境

```bash
# 1. 启动 PostgreSQL + Redis（Docker）
docker compose up -d postgres redis

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，将 localhost 改为实际地址

# 4. 初始化数据库
npm run db:init

# 5. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

### 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | 代码检查 |
| `npm run db:generate` | 生成 Prisma 客户端 |
| `npm run db:migrate` | 创建迁移 |
| `npm run db:migrate:deploy` | 执行迁移 |
| `npm run db:seed` | 填充种子数据 |
| `npm run db:init` | 迁移 + 种子 |

---

## 环境变量参考

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接串 |
| `REDIS_URL` | ✅ | Redis 连接串 |
| `JWT_SECRET` | ✅ | JWT 签名密钥（Docker 部署自动生成） |
| `NEXT_PUBLIC_APP_URL` | - | 应用访问地址 |
| `NODE_ENV` | - | 运行环境 |
| `SMTP_HOST` | 可选 | SMTP 服务器 |
| `SMTP_PORT` | 可选 | SMTP 端口 |
| `SMTP_USER` | 可选 | SMTP 用户名 |
| `SMTP_PASS` | 可选 | SMTP 密码 |
| `SMTP_FROM` | 可选 | 发件人地址 |
| `AI_PROVIDER` | 可选 | AI 服务商 |
| `AI_API_KEY` | 可选 | AI API Key |
| `AI_MODEL` | 可选 | AI 模型 |
| `AI_BASE_URL` | 可选 | AI API 地址 |

---

## 许可证

MIT License
