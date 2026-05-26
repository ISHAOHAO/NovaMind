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
      - DATABASE_URL=postgresql://novamind:novamind_password@postgres:5432/novamind?schema=public&connection_limit=20
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
5. **自动填充种子数据**（默认管理员 + 示例题库 + 系统配置）

### 访问

打开 http://localhost:3000

### 默认管理员

| 字段 | 值 |
|------|------|
| 邮箱 | `admin@novamind.com` |
| 密码 | `admin123` |

> 首次登录后请立即修改密码。管理员默认已通过邮箱验证，无需额外操作。

---

## 用户注册与验证

1. 注册时设置**用户名**（唯一，用于登录）、**昵称**、**邮箱**和**密码**
2. 若管理员开启了**邮箱验证**，注册后需输入邮箱收到的 6 位验证码完成验证
3. 未收到邮件可点击"重新发送验证码"（同一邮箱 60 秒冷却）
4. 验证码错误超过 5 次将锁定 30 分钟
5. 验证通过后即可使用用户名或邮箱登录

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
┌──────────────────────────────────────────┐
│              Docker Network               │
│                                           │
│  ┌──────────┐ ┌───────┐ ┌────┐ ┌──────┐  │
│  │ postgres │ │ redis │ │ app│ │  ws  │  │
│  │  :5432   │ │ :6379 │ │:3000│ │:3001 │  │
│  └──────────┘ └───────┘ └────┘ └──────┘  │
└──────────────────────────────────────────┘
```

---

## 系统配置

所有系统配置在 **管理后台 → 系统设置** 中实时修改，立即生效：

| 类别 | 可配置项 |
|------|----------|
| 站点 | 名称、描述 |
| 注册 | 开放/关闭、IP/设备限制、邮箱验证（注册后需验证方可登录） |
| 体验版 | 启用/关闭、每日时长、强制激活 |
| 安全 | 单设备登录、防账号共享、全局限流、异常检测阈值、最大会话设备数 |
| AI | 服务商、API Key、模型、API 地址、体验版每日限额、学习分析每日限额、笔记总结每日限额 |
| 邮件 | SMTP 服务器、端口、账号、**SMTP 连接测试**（发送测试邮件验证配置） |

---

## 功能概览

### 用户系统
- **用户名/邮箱登录**：注册设置唯一用户名，登录支持用户名或邮箱 + 密码
- **邮箱验证**：管理员可开启注册邮箱验证，未验证用户无法登录；支持重发验证码
- **风控系统**：IP 登录行为全量记录、风险评级、可视化风控看板、IP 封禁/解封；IP/设备限流、验证码发送冷却（IP+邮箱双重限制）、验证码爆破防护（5次错误锁定30分钟）

### 刷题功能
- **五种题型**：单选、多选、判断、填空、完形填空
- **AI 驱动**：题目解析、讲解、相似题、自动出题、上传分析
- **答题记录**：自动保存答题历史，支持错题重练

### 学习分析与笔记
- **学习分析看板**：答题总数/正确率统计、今日学习量、活跃天数、平均用时
- **薄弱知识点识别**：AI 分析错题聚类，识别薄弱知识点并提供学习建议
- **时间趋势图表**：日/周/月学习趋势可视化（柱状图）
- **错题库**：分类筛选错题、查看答题详情、知识点覆盖率分析
- **笔记系统**：按题目记笔记、标记重要性（1-5星）、AI 智能总结关键知识点
- **笔记导出**：支持 Markdown 格式导出，可搜索和组织笔记

### 模拟考试
- **试卷生成**：从题库随机抽题或 AI 按主题自动生成试卷
- **定时考试**：可配置考试时长（1-480 分钟），实时倒计时
- **自动批改**：交卷后自动评分，逐题展示正确答案与解析
- **成绩排名**：考生成绩排序，对标正式考试（打分、排名）

### 管理后台
- **数据可视化**：注册趋势折线图、角色分布饼图、答题趋势柱状图；6 项实时统计卡片
- **用户管理**：搜索（用户名/邮箱/昵称）、角色/封禁/邮箱验证筛选；编辑昵称、重置密码、标记邮箱验证、创建用户、封禁/解封、角色变更、软删除
- **登录风控**：IP 登录行为分析看板、趋势图表、风险评级、IP 封禁/解封管理
- **激活码体系**：批量生成（XXXXX-XXXXX-XXXXX-XXXXX 格式、预设天数）、批量删除、状态筛选、导出 CSV、防暴力枚举（连续失败 20 次锁定 15 分钟）
- **题库审核**：细粒度状态流转（待审 → 审核中 → 通过/驳回/需修改）、AI 审核分析（自动检查答案正确性与题目质量）、审核人员绩效统计
- **反馈管理**：用户提交题目反馈、管理员处理反馈（标记已处理/驳回）
- **审核绩效**：审核人员工作量统计（审核数/通过数/驳回数）、图表对比
- **操作日志**：操作类型筛选、日期范围筛选、分页查看
- **系统配置**：6 大类别 30+ 项配置、SMTP 连接测试、AI 提供商切换
- **导入导出**：支持 JSON / Word (.docx/.doc) / Excel (.xlsx/.xls) 格式导入题目，提供模板下载，AI 上传分析

### 安全机制
- **认证**：JWT + bcryptjs，7 天有效期，设备指纹识别，**数据库用户存在性校验**
- **单设备登录**：多设备登录时自动踢除旧设备
- **激活码体系**：支持体验版 + 永久/限时激活
- **AI 使用限制**：体验用户每日 AI 调用次数限制（题目分析/生成/学习分析/笔记总结独立配额）
- **AI 缓存**：相同 AI 请求自动缓存到数据库，节省 Token 消耗
- **IP/设备限流**：注册限制、登录限制、全局请求限制
- **IP 登录风控**：记录所有登录尝试（成功/失败），IP 风险评级，一键封禁/解封，可视化风控看板
- **操作日志**：所有管理操作完整记录

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| 语言 | TypeScript |
| 样式 | TailwindCSS + shadcn/ui |
| 图表 | Recharts |
| 数据库 | PostgreSQL 16 + Prisma ORM |
| 缓存 | Redis 7 (ioredis) — 全路由覆盖 |
| 认证 | JWT + bcryptjs |
| 实时通信 | WebSocket (ws) |
| 文件解析 | mammoth (Word .docx/.doc) + xlsx (Excel .xlsx/.xls) + sharp (图片压缩) |
| 邮件 | Nodemailer |
| 部署 | Docker + Docker Compose |

---

## 性能

所有 API 路由均通过 Redis 缓存加速，重复访问响应时间 < 15ms：

| 缓存层级 | TTL | 覆盖路由 |
|----------|-----|----------|
| 管理员仪表板 | 60s | `/api/admin/dashboard` |
| 管理路由 | 15-60s | 用户/题库/反馈/风控/日志/审核/配置/模板 |
| 题库/题目 | 120-300s | `/api/questions/*` |
| 用户仪表板 | 15s | `/api/dashboard` |
| 系统配置 | 300s | `/api/admin/settings` |

缓存失效使用 SCAN + 批量 DEL，非阻塞模式匹配清除。数据库连接池 20 连接，支撑高并发查询。

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
| ------ | ------ |
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run lint` | 代码检查 |
| `npm run db:generate` | 生成 Prisma 客户端 |
| `npm run db:migrate` | 创建迁移 |
| `npm run db:migrate:deploy` | 执行迁移 |
| `npm run db:seed` | 填充种子数据 |
| `npm run db:init` | 迁移 + 种子 |
| `npm run db:reset` | 清除数据 |

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
