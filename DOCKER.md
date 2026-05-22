# NovaMind 开发构建指南

---

## 开发环境搭建

### 前置准备

- Node.js >= 18（推荐 22）
- Docker Desktop 或 docker-ce
- （可选）[Docker Hub](https://hub.docker.com/) 账号（推送镜像用）

### 启动开发服务

```bash
# 安装依赖
npm install

# 启动 PostgreSQL + Redis
docker compose up -d postgres redis

# 配置环境变量
cp .env.example .env
# 编辑 .env，确保 DATABASE_URL 和 REDIS_URL 使用 localhost

# 初始化数据库
npm run db:init

# 启动开发服务器
npm run dev
```

---

## Dockerfile 说明

三阶段构建，最小化最终镜像体积：

| 阶段 | 基础镜像 | 作用 |
|------|----------|------|
| `deps` | node:22-alpine | `npm ci --ignore-scripts` 安装依赖 |
| `builder` | node:22-alpine | Prisma generate + Next.js build |
| `runner` | node:22-alpine | 仅含 standalone 产物，`node server.js` 运行 |

### Entrypoint 自动初始化

容器首次启动时，`docker-entrypoint.sh` 自动完成：

1. 生成随机 JWT 签名密钥（存储于 `/app/data/.secrets`，volume 持久化）
2. 执行 `prisma migrate deploy`（数据库迁移）
3. 执行 `tsx prisma/seed.ts`（种子数据）
4. 启动应用

---

## 构建命令

### 本地构建

```bash
# 单架构构建
docker build -t novamind:latest .

# 本地测试运行
docker compose up -d --build
```

### 多架构构建并推送

```bash
# 创建 multiarch builder（仅需一次）
docker buildx create --name multiarch --use
docker buildx inspect --bootstrap

# 构建 amd64 + arm64 并推送
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ishaohao/novamind:latest --push .
```

### 服务器使用预构建镜像

将 `docker-compose.yml` 中 `app` 服务改为：

```yaml
  app:
    image: ishaohao/novamind:latest
    # build: .         # 注释掉
```

---

## docker-compose 服务编排

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| `postgres` | postgres:16-alpine | 5432 | 数据库 |
| `redis` | redis:7-alpine | 6379 | 缓存 |
| `app` | 本地构建 / 远程镜像 | 3000 | Next.js 应用 |

### 数据持久化

| Volume | 挂载点 | 用途 |
|------|------|------|
| `postgres_data` | `/var/lib/postgresql/data` | 数据库文件 |
| `redis_data` | `/data` | Redis AOF 持久化 |
| `app_data` | `/app/data` | JWT 密钥 + 初始化标记 |

---

## 常用开发命令

```bash
npm run dev               # 开发服务器（热重载）
npm run build             # 生产构建
npm run lint              # ESLint 检查
npm run db:generate       # 生成 Prisma 客户端
npm run db:push           # 直接推送 Schema（无迁移文件）
npm run db:migrate        # 创建迁移文件
npm run db:migrate:deploy # 执行迁移
npm run db:seed           # 填充种子数据
npm run db:init           # 迁移 + 种子
```

### Docker 运维命令

```bash
docker compose up -d              # 启动
docker compose down               # 停止
docker compose build app          # 重新构建应用镜像
docker compose up -d --build      # 重新构建并启动
docker compose logs -f app        # 查看应用日志
docker compose exec app sh        # 进入容器
docker compose pull app           # 拉取最新镜像
```

---

## 项目结构

```
NovaMind/
├── Dockerfile              # 多阶段构建 (deps → builder → runner)
├── docker-entrypoint.sh    # 容器入口（自动初始化）
├── docker-compose.yml      # 服务编排
├── .dockerignore           # 构建排除
├── .env.example            # 环境变量模板
├── prisma/
│   ├── schema.prisma       # 数据库 Schema
│   └── seed.ts             # 种子数据
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── (auth)/         # 登录/注册
│   │   ├── (dashboard)/    # 用户端
│   │   ├── admin/          # 管理后台
│   │   └── api/            # API 路由
│   ├── components/ui/      # shadcn/ui 组件
│   ├── lib/                # 工具库 (auth, redis, prisma, ai...)
│   ├── stores/             # Zustand 状态
│   └── types/              # TypeScript 类型
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

---

## 故障排除

| 现象 | 原因 | 解决 |
|------|------|------|
| `COPY /app/public: not found` | 项目缺少 public 目录 | 创建空 `public/` 目录 |
| `prisma schema not found` | postinstall 在 deps 阶段触发 | Dockerfile 已用 `--ignore-scripts` |
| app 启动后退出 | 数据库未就绪 | 等待 postgres healthy 后自动重试 |
| `exec format error` | 镜像架构不匹配 | 使用 `--platform` 匹配目标架构 |
