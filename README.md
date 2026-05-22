# NovaMind - 在线刷题平台

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version" />
  <img src="https://img.shields.io/badge/next.js-15-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/typescript-5.7-blue" alt="TypeScript" />
  <img src="https://img.shields.io/badge/postgresql-16-green" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/redis-7-red" alt="Redis" />
  <img src="https://img.shields.io/badge/docker-ready-blue" alt="Docker" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

---

## 项目简介

**NovaMind** 是一款 AI 驱动的智能在线刷题平台，支持 **单选题、多选题、判断题、填空题、完形填空** 五种题型，面向开发者、学生及各类备考人群。平台提供完整的用户体系、激活码商业化、单设备登录风控、管理员后台、AI 智能解析、题库上传审核等功能，支持 **500+ 用户并发**。

所有系统配置均可在管理员前端面板中实时修改，无需重启服务。

---

## 功能特性

### 用户系统
- 邮箱注册 / 登录，支持验证码验证
- 个人中心：修改昵称、头像、密码
- JWT 鉴权，7 天有效期，自动续期
- 账号封禁 / 解封管理

### 激活码体系
- 未激活用户每日限时体验（默认 30 分钟，后台可调）
- 激活码解锁完整版，支持永久或按有效期
- 批量生成激活码（自定义前缀、数量、有效期）
- 激活码列表查询：未使用 / 已使用 / 已过期，关联使用者
- 支持邮件直接发送激活码

### 单设备登录与防共享
- 同账号仅允许一个设备在线
- 新设备登录自动踢掉旧设备（WebSocket 实时推送）
- WebSocket 心跳机制（每 30s 心跳，90s 超时离线）
- 设备指纹 + IP 综合判定，异常登录需二次验证

### 管理员系统
- **用户管理**：搜索、封禁 / 解封、强制激活、删除、查看详情
- **激活码管理**：批量生成、列表查询、导出 CSV
- **题库审核**：审核用户上传的题库，公开 / 隐藏 / 删除
- **操作日志**：全量记录管理员及关键操作
- **系统配置中心**：所有配置项可在前端面板修改，立即生效

### 题库系统
- **五种题型**：单选题、多选题、判断题、填空题、完形填空
- 支持手动录入或文件导入（JSON / Word .docx / Excel .xlsx）
- 每题支持图片上传（JPG/PNG/WebP/GIF，自动压缩）
- 上传需填写来源说明（防侵权）
- 题库需管理员审核后方可公开
- 搜索、分类、标签、难度筛选
- **刷题模式**：顺序练习、随机抽题、错题重练
- 题目收藏与笔记功能

### 完形填空
- 文章含多个空白，每个空白有独立选项（A/B/C/D）
- 上传时可视化设置空白处选项
- 作答时空白处渲染为下拉选择框，自动判断正误

### AI 功能
- 支持 OpenAI / Claude / 通义千问等多种服务商（后台可配置）
- **AI 解析**：考点分析、解题思路、选项分析、知识拓展（HTML 格式输出）
- **AI 讲解**：通俗易懂地解释答案（HTML 格式输出）
- **AI 相似题**：基于原题生成变体题目（HTML 格式输出）
- **AI 出题**：根据主题和难度自动生成题目
- **AI 审查**：批量审查题目，检测答案错误、选项设计问题、解析矛盾等
- 体验用户每日 AI 次数限制（后台可配）
- 自动清洗 Markdown 代码块，确保输出干净可读

### 风控系统
- 注册风控：IP / 设备指纹 / 邮箱域多重限制
- 防账号共享：设备指纹 + IP + User-Agent 综合检测
- 全局限流（Redis 滑动窗口算法）
- IP / 设备黑名单机制
- 行为异常检测

### 邮件系统
- 注册验证码、密码重置、激活码发放
- SMTP 协议，后台完整可配

### 界面
- 响应式设计，适配移动端
- 暗色模式
- 数据可视化图表（Recharts）
- Toast 消息提示
- 拖拽上传

---

## 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js 15 (App Router) | React 全栈，SSR / API Routes |
| 语言 | TypeScript 5.7 | 类型安全 |
| 样式 | TailwindCSS + tailwindcss-animate | 原子化 CSS + 动画 |
| 组件库 | shadcn/ui (Radix UI) | 28 个高质量 UI 组件 |
| 状态管理 | Zustand | 轻量级全局状态 |
| 表单 | React Hook Form + Zod | 高性能 + Schema 校验 |
| 数据查询 | TanStack Query | 缓存、同步 |
| 图表 | Recharts | 数据可视化 |
| 图标 | Lucide React | 开源图标 |
| 数据库 | PostgreSQL 16 | 关系型数据库 |
| ORM | Prisma 6 | 类型安全 |
| 缓存 | Redis 7 (ioredis) | 会话、限流、在线状态 |
| 实时通信 | WebSocket (ws) | 心跳与设备踢出 |
| 认证 | JWT + bcryptjs | Token 鉴权 + 密码哈希 |
| 邮件 | Nodemailer | SMTP 发送 |
| 文件处理 | sharp / mammoth / xlsx | 图片压缩 / Word 解析 / Excel 解析 |
| 部署 | Docker + Docker Compose | 容器化一键部署 |

---

## 快速开始（Docker）

### 前置要求

- Docker >= 20.10
- Docker Compose >= 2.0

### 步骤

**1. 获取项目**

```bash
git clone <repo-url> novamind
cd novamind
```

或下载源码解压到 `novamind` 目录。

**2. 配置环境变量**

```bash
cp .env.example .env
```

编辑 `.env`，修改关键变量：

```bash
AUTH_SECRET="生成随机密钥"
JWT_SECRET="生成随机密钥"

# 可选：SMTP 邮件（也可在管理后台配）
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="noreply@example.com"
SMTP_PASS="your-password"
SMTP_FROM="NovaMind <noreply@example.com>"
```

**3. 启动**

```bash
docker-compose up -d
```

自动完成：拉取镜像 → 启动 PostgreSQL + Redis → 构建应用 → 运行迁移 → 填充种子数据。

**4. 访问**

打开 http://localhost:3000

**5. 默认管理员**

| 字段 | 值 |
|------|------|
| 邮箱 | `admin@novamind.com` |
| 密码 | `admin123` |
| 角色 | SUPER_ADMIN |

> 首次登录后请在个人中心修改密码。

### 服务架构

```
┌─────────────────────────────────┐
│         Docker Network           │
│                                  │
│  ┌──────────┐ ┌───────┐ ┌────┐  │
│  │ postgres │ │ redis │ │ app│  │
│  │  :5432   │ │ :6379 │ │:3000│  │
│  └──────────┘ └───────┘ └────┘  │
└─────────────────────────────────┘
```

---

## 手动部署（开发环境）

### 前置要求

- Node.js >= 18 (推荐 22)
- PostgreSQL >= 14 (推荐 16)
- Redis >= 6 (推荐 7)

### 步骤

```bash
npm install

cp .env.example .env
# 编辑 .env，将 DATABASE_URL 和 REDIS_URL 改为 localhost

npm run db:init    # 迁移 + 种子数据
npm run dev        # 启动开发服务器
```

访问 http://localhost:3000

---

## 环境变量

| 变量 | 说明 | 默认值 | 必填 |
|------|------|--------|------|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://novamind:...@postgres:5432/novamind` | ✅ |
| `REDIS_URL` | Redis 连接串 | `redis://redis:6379` | ✅ |
| `AUTH_SECRET` | Auth 加密密钥（≥32 位） | - | ✅ |
| `JWT_SECRET` | JWT 签名密钥 | - | ✅ |
| `NEXT_PUBLIC_APP_URL` | 应用地址 | `http://localhost:3000` | ✅ |
| `NODE_ENV` | 运行环境 | `production` | - |
| `SMTP_HOST` | SMTP 服务器 | - | 可选 |
| `SMTP_PORT` | SMTP 端口 | `587` | 可选 |
| `SMTP_USER` | SMTP 用户名 | - | 可选 |
| `SMTP_PASS` | SMTP 密码 | - | 可选 |
| `SMTP_FROM` | 发件人地址 | - | 可选 |

> AI 与邮件配置可在管理后台实时修改，无需通过环境变量。

---

## 项目结构

```
novamind/
├── prisma/
│   ├── schema.prisma          # 数据库 Schema（10 个模型）
│   └── seed.ts                # 种子数据
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # 登录 / 注册
│   │   ├── (dashboard)/       # 用户端
│   │   │   ├── page.tsx       # 仪表盘
│   │   │   ├── profile/       # 个人中心
│   │   │   └── questions/     # 题库
│   │   │       ├── page.tsx           # 浏览列表
│   │   │       ├── [bankId]/          # 刷题练习
│   │   │       └── upload/            # 上传题库
│   │   ├── admin/             # 管理后台
│   │   │   ├── users/         # 用户管理
│   │   │   ├── activation-codes/ # 激活码
│   │   │   ├── questions/     # 题库审核
│   │   │   ├── logs/          # 操作日志
│   │   │   └── settings/      # 系统配置
│   │   └── api/               # API 路由
│   │       ├── auth/          # 认证 (login/register/activate/...)
│   │       ├── admin/         # 管理 (users/codes/questions/logs/settings)
│   │       ├── questions/     # 题库 (CRUD/favorites/notes/practice)
│   │       ├── ai/            # AI (ask/generate/review-questions)
│   │       ├── upload/        # 图片上传
│   │       └── health/        # 健康检查
│   ├── components/ui/         # shadcn/ui 组件（28 个）
│   ├── lib/                   # 工具库
│   │   ├── ai.ts              # AI 封装（ask/analyze/explain/generate）
│   │   ├── ai-usage.ts        # AI 每日限额（Redis）
│   │   ├── auth.ts            # JWT 认证中间件
│   │   ├── config.ts          # 配置缓存读写
│   │   ├── device.ts          # 设备指纹
│   │   ├── email.ts           # 邮件服务
│   │   ├── prisma.ts          # Prisma 客户端
│   │   ├── rate-limit.ts      # 限流与风控
│   │   ├── redis.ts           # Redis 客户端
│   │   ├── utils.ts           # 工具函数
│   │   └── validations.ts     # Zod Schema 校验
│   ├── stores/                # Zustand 状态管理
│   │   ├── app-store.ts       # 应用状态
│   │   ├── auth-store.ts      # 认证状态
│   │   └── practice-store.ts  # 练习状态
│   └── types/index.ts         # TypeScript 类型定义
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

---

## API 接口

### 认证 `/api/auth/*`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册 | - |
| POST | `/api/auth/login` | 登录 | - |
| POST | `/api/auth/logout` | 登出 | ✅ |
| GET | `/api/auth/me` | 获取用户信息 | ✅ |
| PUT | `/api/auth/me` | 更新个人资料 | ✅ |
| POST | `/api/auth/send-verification` | 发送验证码 | - |
| POST | `/api/auth/verify-email` | 验证邮箱 | - |
| POST | `/api/auth/forgot-password` | 忘记密码 | - |
| POST | `/api/auth/reset-password` | 重置密码 | - |
| POST | `/api/auth/activate` | 激活码激活 | ✅ |

### 题库 `/api/questions/*`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/questions` | 题库列表（搜索/分页） | ✅ |
| POST | `/api/questions` | 创建题库 | ✅ |
| GET | `/api/questions/[bankId]` | 题库详情 | ✅ |
| GET | `/api/questions/[bankId]/questions` | 题目列表 | ✅ |
| POST | `/api/questions/[bankId]/questions` | 添加题目 | ✅ |
| GET | `/api/questions/[bankId]/questions/[questionId]` | 题目详情 | ✅ |
| PUT | `/api/questions/[bankId]/questions/[questionId]` | 更新题目 | ✅ |
| POST | `/api/questions/favorites` | 收藏 / 取消 | ✅ |
| GET | `/api/questions/notes` | 获取笔记 | ✅ |
| POST | `/api/questions/notes` | 保存笔记 | ✅ |
| POST | `/api/questions/practice/record` | 提交答题记录 | ✅ |
| GET | `/api/questions/practice/history` | 答题历史 | ✅ |
| POST | `/api/questions/upload` | 文件导入题目 | ✅ |
| GET | `/api/questions/template` | 下载模板 | - |

### AI `/api/ai/*`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/ai/ask` | AI 解析 / 讲解 / 相似题 | ✅ |
| POST | `/api/ai/generate` | AI 按主题出题 | ✅ |
| POST | `/api/ai/review-questions` | AI 批量审查 | ✅ |

### 管理员 `/api/admin/*`

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/admin/users` | 用户列表 | 🔑 |
| PUT | `/api/admin/users/[userId]` | 更新 / 封禁用户 | 🔑 |
| DELETE | `/api/admin/users/[userId]` | 删除用户 | 🔑 |
| GET | `/api/admin/activation-codes` | 激活码列表 | 🔑 |
| POST | `/api/admin/activation-codes` | 批量生成 | 🔑 |
| GET | `/api/admin/activation-codes/export` | 导出 CSV | 🔑 |
| GET | `/api/admin/questions` | 待审题库 | 🔑 |
| PUT | `/api/admin/questions/[bankId]` | 审核 / 公开 | 🔑 |
| DELETE | `/api/admin/questions/[bankId]` | 删除题库 | 🔑 |
| GET | `/api/admin/logs` | 操作日志 | 🔑 |
| GET | `/api/admin/settings` | 系统配置 | 🔑 |
| PUT | `/api/admin/settings` | 更新配置 | 🔑 |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查（DB + Redis） |

> ✅ = 需登录  🔑 = 需管理员  `-` = 无需认证

---

## 数据库

### 核心表

| 表 | 说明 | 关键字段 |
|------|------|----------|
| `User` | 用户 | email, password, name, role, isActivated, banned |
| `UserSession` | 会话 | userId, token, deviceId, ip, isActive, lastPingAt |
| `ActivationCode` | 激活码 | code, prefix, batchId, duration, isUsed, status |
| `QuestionBank` | 题库 | title, description, source, category, tags, difficulty, status |
| `Question` | 题目 | bankId, type, content, options(JSON), answer, analysis, image |
| `UserQuestionRecord` | 答题记录 | userId, questionId, userAnswer, isCorrect, duration |
| `Favorite` | 收藏 | userId, questionId |
| `Note` | 笔记 | userId, questionId, content |
| `SystemConfig` | 配置 | key(唯一), value, description |
| `AuditLog` | 日志 | userId, action, details, ip, userAgent |
| `RateLimit` | 限流 | key(唯一), count, resetAt |

### 枚举

| 枚举 | 值 |
|------|------|
| `UserRole` | USER, ADMIN, SUPER_ADMIN |
| `QuestionStatus` | PENDING, APPROVED, REJECTED |
| `ActivationCodeStatus` | UNUSED, USED, EXPIRED |

### 题目类型

| 值 | 说明 |
|------|------|
| `single` | 单选题 |
| `multiple` | 多选题 |
| `truefalse` | 判断题 |
| `fillblank` | 填空题 |
| `cloze` | 完形填空 |

---

## 生产部署

### 推荐配置

- CPU: 2 核+
- 内存: 4 GB+
- 系统: Ubuntu 22.04 / Debian 12
- 磁盘: 20 GB+

### 部署

```bash
mkdir -p /opt/novamind && cd /opt/novamind

# 上传项目或 git clone
cp .env.example .env
# 编辑生产环境密钥

docker-compose up -d --build
```

### Nginx 反向代理

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

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

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
        proxy_read_timeout 86400;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/novamind /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL 证书
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 数据备份

```bash
# PostgreSQL
docker exec novamind-postgres pg_dump -U novamind novamind > backup_$(date +%Y%m%d).sql

# Redis AOF 自动持久化至 redis_data volume
```

---

## 系统配置

所有配置在 **管理后台 → 系统设置** 中实时修改，立即生效。

| Key | 说明 | 默认值 |
|------|------|--------|
| `site_name` | 站点名称 | NovaMind |
| `register_enabled` | 开放注册 | true |
| `register_ip_limit` | IP 每日注册上限 | 5 |
| `register_device_limit` | 设备每日注册上限 | 3 |
| `trial_enabled` | 启用体验版 | true |
| `trial_daily_minutes` | 体验版每日时长（分钟） | 30 |
| `max_session_devices` | 同时在线设备数 | 1 |
| `global_rate_limit` | 全局每分钟限流 | 100 |
| `anti_sharing_enabled` | 防账号共享 | true |
| `question_review_required` | 题库需审核 | true |
| `ai_enabled` | 启用 AI | false |
| `ai_provider` | AI 服务商 | openai |
| `ai_api_key` | AI 密钥 | - |
| `ai_model` | AI 模型 | gpt-4o-mini |
| `ai_base_url` | AI API 地址 | https://api.openai.com/v1 |
| `ai_trial_daily_limit` | 体验用户 AI 日限额 | 20 |
| `smtp_host` | SMTP 服务器 | - |
| `smtp_port` | SMTP 端口 | 587 |
| `smtp_user` | SMTP 用户名 | - |
| `smtp_pass` | SMTP 密码 | - |
| `smtp_from` | 发件人 | - |

### 配置缓存

内存缓存（30s TTL）+ 数据库双层架构。后台修改后立即刷新缓存，Redis 不可用时配置仍正常工作。

---

## 安全

| 特性 | 实现 |
|------|------|
| 密码加密 | bcryptjs, 盐 12 轮 |
| JWT 鉴权 | 7 天有效期，Bearer Token / Cookie 双模式 |
| API 限流 | Redis 滑动窗口 |
| 注册风控 | IP / 设备指纹 / 邮箱域多重限制 |
| 单设备登录 | 踢旧设备，WebSocket 推送 |
| 防账号共享 | 设备指纹 + IP + UA 综合判定 |
| IP 黑名单 | 自动 / 手动加入 Redis |
| 操作审计 | 管理员及关键操作全量记录 |
| 输入校验 | Zod Schema 严格校验 |
| 环境变量隔离 | NEXT_PUBLIC_ 前缀区分前后端 |

---

## 性能优化（500+ 并发）

| 优化项 | 方案 |
|--------|------|
| 数据库连接池 | Prisma 自动管理，最大 200 连接 |
| Redis 缓存 | 热点数据缓存，减少 DB 查询 80%+ |
| 滑动窗口限流 | Redis ZSET O(log N) |
| WebSocket | 心跳保活 + 超时清理 |
| API 轻量化 | 按需字段 + 分页 |
| 图片上传 | sharp 压缩，最大 1200x1200，JPEG 质量 80% |

---

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm start` | 生产服务器 |
| `npm run db:generate` | 生成 Prisma 客户端 |
| `npm run db:push` | 推送 Schema（开发用） |
| `npm run db:migrate` | 创建迁移 |
| `npm run db:migrate:deploy` | 执行迁移 |
| `npm run db:seed` | 填充种子数据 |
| `npm run db:init` | 迁移 + 种子（一键初始化） |

---

## 常见问题

<details>
<summary><b>Q: Docker 启动后无法访问？</b></summary>

检查容器状态：`docker-compose ps`，查看日志：`docker-compose logs app`，等待 30 秒让数据库完全启动。
</details>

<details>
<summary><b>Q: 邮件功能不工作？</b></summary>

1. 确认 SMTP 配置正确（后台或 .env）
2. QQ/163 邮箱需使用授权码而非登录密码
3. SMTP 未配置时系统自动跳过邮件发送
</details>

<details>
<summary><b>Q: 如何重置管理员密码？</b></summary>

方式一：登录后个人中心修改。方式二：数据库直接更新 bcrypt 哈希。方式三：修改 prisma/seed.ts 后重新 `npm run db:seed`。
</details>

<details>
<summary><b>Q: WebSocket 连接失败？</b></summary>

检查防火墙是否开放 3001 端口。Nginx 需配置 `Upgrade` 和 `Connection` 头。Docker 部署时内网通信不需额外开放端口。
</details>

<details>
<summary><b>Q: 如何更换 AI 服务商？</b></summary>

管理后台 → 系统设置，修改 `ai_provider`、`ai_base_url`、`ai_api_key`、`ai_model`，设置 `ai_enabled` 为 true。
</details>

<details>
<summary><b>Q: 题库上传支持哪些格式？</b></summary>

- **JSON**（推荐）：结构化批量导入
- **Word** (.docx)：自动解析题目
- **Excel** (.xlsx/.xls)：自动解析题目
- 支持下载模板参考格式
</details>

<details>
<summary><b>Q: 完形填空如何录入和作答？</b></summary>

上传时，文章中用 `__1__`、`__2__` 标记空白，在「空白处选项设置」中为每个空配置 A/B/C/D 选项，答案用逗号分隔（如 `A,C,B,D`）。作答时空白处自动渲染为下拉选择框。
</details>

---

## 许可证

MIT License

---

<p align="center">
  <b>NovaMind</b> — AI 驱动的智能刷题平台
</p>
