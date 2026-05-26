# NovaMind 项目完整分析

> AI 驱动的在线刷题平台 - 功能清单与架构分析  
> 生成时间: 2026年5月26日

---

## 📋 项目概览

**项目名称**: NovaMind  
**框架**: Next.js 15 (App Router) + TypeScript  
**数据库**: PostgreSQL 16  
**缓存**: Redis 7  
**UI 框架**: React + Radix UI + Tailwind CSS  
**状态管理**: Zustand  
**表单**: React Hook Form + Zod  
**图表**: Recharts  
**API 文档**: REST + WebSocket  

### 🎯 核心功能
- AI 驱动的题目评估和生成
- 用户认证与权限管理（USER、ADMIN、SUPER_ADMIN）含数据库用户存在性校验
- 在线题库管理和练习
- 题目上传与审核系统（细粒度状态流转 + AI 审核分析）
- 用户反馈系统（提交题目问题反馈，管理员处理）
- 学习分析看板（数据统计 + AI 薄弱点识别 + 时间趋势）
- 模拟考试模式（试卷生成 + 定时 + 评分 + 排名）
- 笔记系统（重要性标记 + AI 总结 + 搜索导出 + 内联编辑 + 刷题时边答边记）
- 用户激活码管理
- 完整的审计日志系统
- **IP 登录风控系统**（登录尝试记录、风险评级、可视化看板、IP 封禁/解封）
- WebSocket 实时通信
- 邮件验证系统

---

## 1️⃣ 所有 API 路由详解

### 📊 API 统计: **56 个路由**

#### 🔐 认证模块 (11 个)
```
/api/auth/
├── login               [POST]      - 用户登录
├── logout              [POST]      - 用户登出
├── register            [POST]      - 用户注册
├── me                  [GET]       - 获取当前用户信息
├── activate            [POST]      - 激活激活码
├── verify-email        [POST]      - 邮件验证
├── send-verification   [POST]      - 发送验证邮件
├── verify-registration [POST]      - 验证注册证书
├── forgot-password     [POST]      - 忘记密码请求
├── reset-password      [POST]      - 重置密码
└── resend-registration-verification [POST] - 重新发送注册验证
```

#### 🤖 AI 功能模块 (4 个)
```
/api/ai/
├── ask                 [POST]      - AI 对话（需要日次限制）
├── generate            [POST]      - AI 生成题目
├── analyze-upload      [POST]      - 分析上传的题目文件
├── review-questions    [POST]      - AI 审查题目内容（答案一致性、知识性错误、选项设计、解析、格式规范）
```

#### 📚 题库与练习 (10 个)
```
/api/questions/
├── [bankId]/           [GET]       - 获取指定题库的题目
├── [bankId]/questions  [GET]       - 获取题库下题目列表
├── [bankId]/questions/[questionId] [GET/PUT] - 题目详情 / 更新题目
├── practice/record     [POST]      - 记录练习数据
├── practice/history    [GET]       - 答题历史记录
├── favorites           [GET/POST]  - 收藏管理
├── notes               [GET/POST]  - 笔记管理（支持搜索/分页/重要性筛选）
├── upload              [POST]      - 上传题库（JSON/Word .docx.doc/Excel .xlsx.xls）
├── template            [GET]       - 获取导入模板
└── [root]              [GET/POST]  - 获取或创建题库
```

#### 📊 学习分析模块 (5 个) 
```
/api/analytics/
├── overview            [GET]       - 学习概览（总数/正确率/活跃天数）
├── weak-points         [GET]       - AI 薄弱知识点识别（需 AI 限额）
├── time-trends         [GET]       - 学习时间趋势（日/周/月图表数据）
└── error-bank          [GET]       - 错题库 + 知识点覆盖率

/api/dashboard/
└── [root]              [GET]       - 用户仪表板数据（今日统计 + 周趋势 + 最近活动）
```

#### 📝 笔记增强模块 (2 个) 
```
/api/notes/
├── ai-summary          [POST]      - AI 总结笔记关键知识点（需 AI 限额）
└── export              [GET]       - 导出笔记（Markdown 下载）
```

**前端**: 笔记管理页支持内联编辑（铅笔图标进入编辑模式），刷题页提供折叠式笔记面板（一键展开、自动加载已有笔记、边刷题边编辑内容及重要性评分）

#### 📋 模拟考试模块 (4 个) 
```
/api/exams/
├── [examId]/           [GET/PUT/DELETE] - 考试详情 / 开始/作答/交卷 / 删除
├── generate            [POST]      - AI 生成试卷（需 AI 限额）
├── ranking             [GET]       - 考试成绩排名
└── [root]              [GET/POST]  - 考试列表 / 创建考试
```

#### 📤 上传与反馈 (2 个)
```
/api/upload/
└── image              [POST]      - 图片上传

/api/reports/
└── [root]             [GET/POST]  - 查看自己的反馈 / 提交反馈
```

#### 👨‍💼 管理员模块 (16 个)
```
/api/admin/
├── dashboard/           [GET]       - 管理员仪表板数据
├── users                [GET/PUT]   - 用户管理
├── users/[userId]       [GET/PUT]   - 编辑单个用户
├── questions            [GET/PUT]   - 题库审核管理（5种状态）
├── questions/[bankId]   [PUT]       - 审核单个题库（含绩效统计）
├── activation-codes     [GET/POST]  - 激活码管理
├── activation-codes/export [POST]   - 导出激活码
├── review-templates     [GET/POST/PUT/DELETE] - 审核模板管理
├── reports              [GET/PUT]  - 反馈管理 
├── reviewer-stats       [GET]       - 审核人员绩效统计 
├── risk-control/overview [GET]      - 风控概览（登录尝试统计、趋势数据）
├── risk-control/ips     [GET/POST/DELETE] - IP 风控管理（聚合统计、封禁/解封）
├── risk-control/attempts [GET]      - 登录尝试记录查询 
├── settings             [GET/PUT]   - 系统配置
├── smtp-test            [POST]      - 邮件服务测试
└── logs                 [GET]       - 审计日志查看
```

#### 🔗 WebSocket 与健康检查 (2 个)
```
/api/
├── ws/status          [GET]       - WebSocket 连接状态
└── health             [GET]       - 健康检查
```

---

## 2️⃣ UI 组件库 (29 个)

**位置**: `src/components/ui/`

### 基础组件
| 组件名 | 类型 | 用途 |
|-------|------|------|
| `button.tsx` | 按钮 | 基础按钮组件 (Radix UI) |
| `input.tsx` | 输入框 | 文本输入 |
| `textarea.tsx` | 多行输入 | 长文本编辑 |
| `label.tsx` | 标签 | 表单标签 |
| `card.tsx` | 卡片 | 内容容器 |
| `badge.tsx` | 徽章 | 状态标记 |
| `avatar.tsx` | 头像 | 用户头像 |
| `separator.tsx` | 分隔符 | 内容分割 |

### 表单组件
| 组件名 | 类型 | 用途 |
|-------|------|------|
| `checkbox.tsx` | 复选框 | 多选项 |
| `radio-group.tsx` | 单选框 | 排他选择 |
| `select.tsx` | 下拉选择 | 列表选择 |
| `toggle.tsx` | 开关 | 状态切换 |
| `switch.tsx` | 滑动开关 | 布尔开关 |
| `slider.tsx` | 滑块 | 范围选择 |

### 交互组件
| 组件名 | 类型 | 用途 |
|-------|------|------|
| `dialog.tsx` | 对话框 | 模态窗口 |
| `alert-dialog.tsx` | 警告对话框 | 确认弹窗 |
| `popover.tsx` | 浮层 | 信息提示 |
| `dropdown-menu.tsx` | 下拉菜单 | 选项菜单 |
| `tooltip.tsx` | 工具提示 | 悬停提示 |
| `tabs.tsx` | 选项卡 | 标签页 |
| `accordion.tsx` | 折叠面板 | 可折叠内容 |

### 数据展示
| 组件名 | 类型 | 用途 |
|-------|------|------|
| `table.tsx` | 表格 | 数据表格 (TanStack) |
| `progress.tsx` | 进度条 | 进度显示 |
| `scroll-area.tsx` | 滚动区域 | 可滚动容器 |
| `skeleton.tsx` | 骨架屏 | 加载状态 |
| `loading-screen.tsx` | 加载屏幕 | 全屏加载动画（Brain 浮动 + 脉冲光环 + 渐变进度条）/ 区域加载覆盖层 / 页面加载 |
| `toast.tsx` + `toaster.tsx` | 提示 | 消息提示 |

### 工具函数
| 文件名 | 用途 |
|-------|------|
| `use-toast.ts` | 提示 Hook |

---

## 3️⃣ 核心业务逻辑 (lib 文件夹)

**位置**: `src/lib/`

### 核心文件详解

#### 🔐 `auth.ts` - JWT 认证系统
- Token 签名与验证
- Bearer Token 解析
- Cookie 读取
- **数据库用户存在性校验**（防止数据库重建后旧 token 被误用）
- 认证中间件装饰器
  - `requireAuth()` - 需登录（含用户存在性验证）
  - `requireAdmin()` - 需管理员权限（含用户存在性验证）

```typescript
类型: TokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}
```

#### 🤖 `ai.ts` - AI 功能核心
- 配置管理 (Provider、API Key、Model、Base URL)
- OpenAI 兼容 API 支持
- **AI 响应缓存**：SHA256 哈希键自动缓存，30 天有效期，节省 Token
- 流式响应处理
- Markdown 代码块清理
- 错误处理与日志

```typescript
askAi(prompt: string, systemPrompt?: string, skipCache?: boolean): Promise<{
  success: boolean;
  content: string;
  error?: string;
  cached?: boolean;  // 是否命中缓存
}>
```

#### 📊 `ai-usage.ts` - AI 使用限制
- 多维度日次限制检查 (Redis Lua 原子操作)
- 使用量统计与 TTL 管理
- 用户配额追踪（激活用户免限制）

```typescript
ai_trial_daily_limit        // AI 题目分析/生成 (默认 20 次/天)
ai_analysis_daily_limit     // 学习分析 AI (默认 5 次/天) 
ai_note_summary_daily_limit // 笔记 AI 总结 (默认 5 次/天) 
ai_upload_analyze_monthly_limit // 上传分析 (默认 10 次/月)

原子操作: checkAndIncrement* 函数使用 Redis Lua EVAL 避免竞态条件
```

#### 🌍 `redis.ts` - Redis 缓存层
- 即连模式（`lazyConnect: false`），避免冷启动延迟
- TCP Keep-Alive 30s（`keepAlive: 30000`），保持长连接
- 连接超时 5s（`connectTimeout: 5000`） + 命令超时 5s（`commandTimeout: 5000`）
- 重试策略：最多 5 次，间隔 150ms~1500ms
- 离线队列开启（`enableOfflineQueue: true`），命令在连接就绪前排队等待
- `reconnectOnError` 处理 READONLY 故障转移
- **Pipeline + UNLINK** 非阻塞批量缓存失效（替代 SCAN + 逐个 DEL）

#### 🔗 `prisma.ts` - ORM 实例
- 单例 Prisma 连接
- 全局可访问
- 生产环境仅记录 `error` / `warn` 日志（避免查询日志 IO 开销）
- 开发环境额外输出 `query` 日志便于调试
- 连接池 `connection_limit=15` + `pool_timeout=10s`

#### ⚙️ `config.ts` - 系统配置
- 动态配置获取 (`getSystemConfig()`)
- 批量配置查询 (`getSystemConfigs()`)
- 配置设置 (`setSystemConfig()`)
- 30秒缓存机制

**配置键示例**:
- `ai_provider`, `ai_api_key`, `ai_model`, `ai_base_url`, `ai_enabled`
- `ai_trial_daily_limit`
- `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`

#### 📧 `email.ts` - 邮件服务
- SMTP 配置管理
- 邮件发送 (注册验证、密码重置等)
- 模板渲染
- 错误重试

#### 📏 `rate-limit.ts` - 速率限制
- API 请求频率控制
- 基于 IP/用户 ID
- Redis 支持
- **IP 黑名单管理**（Redis `blacklist:*` 键 + DB `IpBlockRule` 双重封禁）

#### 🔍 `validations.ts` - Zod 校验规则
- 注册验证
- 登录验证
- 密码修改验证
- 个人资料更新验证
- 题库创建验证

```typescript
规则示例:
- email: 正确格式的邮箱
- password: 最少6位，最多100位
- username: 2-30个字符，仅支持中英文、数字、下划线
- name: 1-50个字符
```

#### 🛠️ `utils.ts` - 通用工具函数
- 字符串处理
- 日期格式化
- 加密解密
- HTTP 响应构造

#### 📱 `device.ts` - 设备识别
- Device ID 生成
- 设备指纹识别
- 会话关联

---

## 4️⃣ 页面结构详解

**位置**: `src/app/`

### 整体架构
```
src/app/
├── (auth)/                          # 认证路由组（版面隔离）
│   ├── layout.tsx
│   ├── login/page.tsx               # 登录页
│   ├── register/page.tsx            # 注册页
│   └── verify-email/page.tsx        # 邮箱验证页
│
├── (dashboard)/                     # 仪表板路由组
│   ├── layout.tsx
│   ├── profile/page.tsx             # 用户资料页
│   ├── analytics/page.tsx           # 学习分析看板 
│   ├── questions/page.tsx           # 题库列表页
│   ├── questions/[bankId]/page.tsx  # 题库详情/练习页（含笔记面板/AI辅助）
│   ├── notes/page.tsx               # 笔记管理 
│   ├── exams/page.tsx               # 模拟考试列表 
│   └── exams/[examId]/page.tsx      # 考试答题页 
│
├── admin/                           # 管理员区域
│   ├── layout.tsx
│   ├── page.tsx                     # 管理员首页
│   ├── activation-codes/page.tsx    # 激活码管理
│   ├── logs/page.tsx                # 审计日志
│   ├── questions/page.tsx           # 题库审核（5种状态）
│   ├── reports/page.tsx              # 反馈管理
│   ├── reviewer-stats/page.tsx      # 审核人员绩效
│   ├── risk-control/page.tsx        # 登录风控看板
│   ├── settings/page.tsx            # 系统设置
│   └── users/page.tsx               # 用户管理
│
├── dashboard/
│   ├── layout.tsx
│   ├── loading.tsx                    # 仪表板骨架屏
│   └── page.tsx                       # 主仪表板
│
├── api/                             # API 路由（见本文 1️⃣ 部分）
│
├── globals.css                      # 全局样式
├── layout.tsx                       # 根级布局
├── page.tsx                         # 首页
└── providers.tsx                    # 上下文提供者
```

### 关键页面功能

| 页面 | 功能 | 状态检查 |
|------|------|--------|
| `/login` | 用户登录 | 需验证邮箱 |
| `/register` | 用户注册 | 验证激活码 |
| `/verify-email` | 邮件验证 | 在线等待 |
| `/dashboard` | 主仪表板（快捷入口: 刷题/错题/上传/笔记/学习分析） | 需认证 |
| `/analytics` | 学习分析看板 | 需认证 |
| `/profile` | 用户资料 | 需认证 |
| `/questions` | 题库列表 | 需认证 |
| `/notes` | 笔记管理（全部/高重要/AI 筛选，内联编辑，AI 总结，导出） | 需认证 |
| `/exams` | 模拟考试 | 需认证 |
| `/admin/*` | 管理员功能 | 需管理员权限 |

### 路由组特点
- `(auth)` - 无导航栏的认证布局
- `(dashboard)` - 有导航栏的用户布局（侧边栏: 首页/题库/模拟考试/笔记/学习分析/个人中心 + 管理员可见管理后台）
- `admin/*` - 管理员专用布局
- 使用 Next.js 13+ 的路由组特性隔离视图

---

## 5️⃣ Hooks 与状态管理

**位置**: `src/hooks/` 和 `src/stores/`

### 🪝 Custom Hooks (2 个)

#### `use-auth.ts` - 认证 Hook
**职责**: 
- 用户登录/注册/登出
- Token 和用户信息管理
- LocalStorage 持久化
- 认证状态追踪

```typescript
// 接口
useAuth() => {
  user: User | null;
  loading: boolean;
  token: string | null;
  login(email, password): Promise<{token, user}>;
  register(email, password, name): Promise<{user}>;
  logout(): Promise<void>;
  updateProfile(data): Promise<User>;
  // ...
}
```

#### `use-websocket.ts` - WebSocket Hook
**职责**:
- WebSocket 连接管理
- 实时消息收发
- 自动重连
- 连接状态监听

```typescript
// 功能
- useWebSocket(url): {
    connected: boolean;
    send(message): void;
    on(event, handler): void;
    // ...
  }
```

---

### 📦 Zustand 状态管理 (4 个 Store)

#### 1️⃣ `auth-store.ts` - 认证状态存储
**状态**:
- `user`: 用户信息
- `token`: JWT Token
- `isLoading`: 加载状态
- `isAuthenticated`: 认证状态

**操作**:
- `setAuth(user, token)` - 设置认证
- `clearAuth()` - 清除认证
- `updateUser(userData)` - 更新用户
- `initialize()` - 从本地存储初始化

**持久化**: LocalStorage (`novamind_token`, `novamind_user`)

#### 2️⃣ `practice-store.ts` - 练习会话状态
**状态**:
- `mode`: 练习模式 (`sequential` | `random` | `wrong`)
- `questions`: 题目数组
- `currentIndex`: 当前题目索引
- `answers`: Map<questionId, answer>
- `results`: Map<questionId, isCorrect>
- `sessionId`: 会话 ID
- `startTime`: 开始时间
- `isCompleted`: 完成状态

**操作**:
- `setMode(mode)` - 切换模式
- `setQuestions(questions)` - 加载题目
- `answerQuestion(id, answer, isCorrect)` - 回答题目
- `nextQuestion()` / `prevQuestion()` - 导航
- `startSession(sessionId)` - 开始会话
- `resetSession()` - 重置会话
- `getCorrectCount()` - 获取正确数
- `getWrongQuestions()` - 获取错题
- `getProgress()` - 获取进度

#### 3️⃣ `exam-store.ts` - 考试会话状态 
**状态**:
- `exam`: 当前考试数据
- `currentIndex`: 当前题目索引
- `answers`: Map<questionId, answer>
- `timeRemaining`: 剩余时间（秒）
- `isTimerRunning`: 计时器状态
- `isCompleted`: 完成状态

**操作**:
- `setExam(exam)` - 设置考试数据
- `startTimer()` - 启动倒计时
- `stopTimer()` - 停止计时器
- `tickTimer()` - 每秒更新
- `answerQuestion(id, answer)` - 作答
- `nextQuestion()` / `prevQuestion()` - 导航
- `resetExam()` - 重置考试

#### 4️⃣ `app-store.ts` - 应用全局状态
**状态**:
- `sidebarOpen`: 侧边栏展开
- `theme`: 主题 (`light` | `dark`)
- `wsConnected`: WebSocket 连接
- `isOnline`: 网络在线

**操作**:
- `toggleSidebar()` - 切换侧边栏
- `setSidebarOpen(open)` - 设置侧边栏
- `setTheme(theme)` - 设置主题
- `setWsConnected(connected)` - WebSocket 状态
- `setIsOnline(online)` - 网络状态

**持久化**: LocalStorage (`novamind_theme`)

---

## 6️⃣ 类型定义系统

**位置**: `src/types/index.ts`

### 核心数据类型

#### 👤 User 类型
```typescript
interface User {
  id: string;
  email: string;
  username?: string | null;
  name: string;
  avatar?: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  isActivated: boolean;           // 激活码激活
  emailVerified: boolean;         // 邮箱验证
  activatedAt?: string | null;
  banned: boolean;
  todayUsedSeconds: number;       // 当日使用秒数
  lastUsedDate?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

#### 📝 Question 类型
```typescript
interface Question {
  id: string;
  bankId: string;
  type: "single" | "multiple" | "truefalse" | "fillblank" | "cloze";
  content: string;
  options: QuestionOption[];      // { key, value }
  answer: string;
  analysis?: string | null;
  sortOrder: number;
  // 客户端状态
  userAnswer?: string;
  isCorrect?: boolean;
  showAnalysis?: boolean;
  isFavorite?: boolean;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

enum QuestionType {
  single = "single",              // 单选
  multiple = "multiple",          // 多选
  truefalse = "truefalse",        // 判断题
  fillblank = "fillblank",        // 填空
  cloze = "cloze"                 // 完形填空
}
```

#### 📚 QuestionBank 类型
```typescript
interface QuestionBank {
  id: string;
  title: string;
  description?: string | null;
  source: string;                 // 题库来源
  category: string;               // 分类
  tags: string[];
  difficulty: number;             // 1-5
  status: "PENDING" | "REVIEWING" | "APPROVED" | "REJECTED" | "NEEDS_REVISION";
  isPublic: boolean;
  uploaderId: string;
  reviewComment?: string | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  reviewTemplateId?: string | null;
  reviewer?: { name: string; email: string } | null;
  _count?: { questions: number }; // 题目数量
  createdAt: string;
  updatedAt: string;
}

enum QuestionStatus {
  PENDING,           // 待审核
  REVIEWING,         // 审核中
  APPROVED,          // 已通过
  REJECTED,          // 已驳回
  NEEDS_REVISION     // 需修改
}
```

#### 🎟️ ActivationCode 类型
```typescript
interface ActivationCode {
  id: string;
  code: string;                   // 激活码本体
  prefix: string;                 // 前缀
  batchId: string;                // 批次 ID
  duration: number;               // 有效期（天）
  isUsed: boolean;
  usedById?: string | null;
  usedAt?: string | null;
  expiresAt?: string | null;
  status: "UNUSED" | "USED" | "EXPIRED";
  createdAt: string;
}
```

#### 📋 AuditLog 类型
```typescript
interface AuditLog {
  id: string;
  userId?: string | null;
  action: string;                 // 操作类型
  details?: string | null;        // 操作详情
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}
```

#### 🆕 LoginAttempt 类型 
```typescript
interface LoginAttempt {
  id: string;
  userId?: string | null;
  email: string;
  ip: string;
  success: boolean;
  reason?: string | null;
  userAgent?: string | null;
  createdAt: string;
}
```

#### 🆕 IpBlockRule 类型 
```typescript
interface IpBlockRule {
  id: string;
  ip: string;
  reason?: string | null;
  blockedAt: string;
  blockedBy?: string | null;
  expiresAt?: string | null;    // null = 永久封禁
}
```

#### 🎮 PracticeRecord 类型
```typescript
interface PracticeRecord {
  id: string;
  userId: string;
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  duration: number;               // 花费秒数
  sessionId?: string | null;
  question?: Question;
  createdAt: string;
}
```

#### 🔧 系统类型
```typescript
interface SystemConfig {
  id: string;
  key: string;
  value: string;
  description: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ApiResponse<T = unknown> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

type PracticeMode = "sequential" | "random" | "wrong";
```

#### 🆕 Exam 类型 
```typescript
interface Exam {
  id: string;
  title: string;
  description?: string | null;
  userId: string;
  durationMinutes: number;
  difficulty: number;
  totalQuestions: number;
  correctCount: number;
  score: number;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  startedAt?: string | null;
  completedAt?: string | null;
  settings: Record<string, any>;
  _count?: { questions: number };
  createdAt: string;
  updatedAt: string;
}

interface ExamQuestion {
  id: string;
  examId: string;
  questionId: string;
  userAnswer?: string | null;
  isCorrect?: boolean | null;
  sortOrder: number;
  question: Question;
}

enum ExamStatus {
  DRAFT,         // 草稿
  IN_PROGRESS,   // 进行中
  COMPLETED,     // 已完成
  ABANDONED      // 已放弃
}
```

#### 🆕 Note 增强字段
```typescript
interface Note {
  // ... 原有字段
  importance: number;        // 重要性 0-5
  isAiGenerated: boolean;    // 是否 AI 生成
}
```

#### 🆕 审核模板与反馈类型
```typescript
interface ReviewTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  isDefault: boolean;
  createdAt: string;
}

interface Report {
  id: string;
  reporterId: string;
  questionBankId: string;
  questionId?: string | null;
  reason: string;
  status: "PENDING" | "RESOLVED" | "DISMISSED";
  handledById?: string | null;
  handledAt?: string | null;
  handleNote?: string | null;
  reporter?: { name: string; email: string };
  questionBank?: { title: string };
  question?: { content: string };
  handler?: { name: string; email: string };
  createdAt: string;
}

interface AiCache {
  id: string;
  promptHash: string;     // SHA256 哈希
  prompt: string;
  response: string;
  model: string;
  expiresAt: string;       // 30 天过期
}

interface ReviewerDailyStats {
  userId: string;
  date: string;
  reviewedCount: number;
  approvedCount: number;
  rejectedCount: number;
  needsRevisionCount: number;
  avgReviewTime: number;
}
```

---

## 📊 数据库模型概览

**数据库**: PostgreSQL 16  
**迁移工具**: Prisma

### 主要数据表 (18 个模型)
```
User                    # 用户表
├── UserSession        # 用户会话
├── ActivationCode     # 激活码
├── Favorite           # 收藏
├── Note              # 笔记（含重要性标记 / AI 生成标识 / 题目关联）
└── Exam              # 模拟考试 

QuestionBank           # 题库表
└── Question          # 题目表

Exam                    # 考试表 
└── ExamQuestion      # 考试题目关联 

UserQuestionRecord     # 练习记录

ReviewTemplate         # 审核意见模板

ReviewerDailyStats     # 审核人员每日绩效

Report                 # 用户反馈 

AiCache                # AI 响应缓存 

LoginAttempt           # 登录尝试记录 （含 IP、成功/失败、原因、UserAgent）

IpBlockRule            # IP 封禁规则 （支持定时过期自动解封）

Report                 # 用户反馈 （PENDING/RESOLVED/DISMISSED）

AiCache                # AI 响应缓存 （SHA256 哈希键，30 天过期）

AuditLog              # 审计日志

SystemConfig          # 系统配置

RateLimit             # 数据库限流计数器
```

### 状态枚举
| 枚举 | 值 |
|------|---|
| `UserRole` | USER, ADMIN, SUPER_ADMIN |
| `QuestionStatus` | PENDING, REVIEWING, APPROVED, REJECTED, NEEDS_REVISION |
| `ExamStatus` | DRAFT, IN_PROGRESS, COMPLETED, ABANDONED |
| `ActivationCodeStatus` | UNUSED, USED, EXPIRED |

### 关键索引策略
- `User`: email, username, role, banned, isActivated, emailVerified, createdAt
- `QuestionBank`: status, category, difficulty, isPublic, uploaderId, reviewedById, createdAt, (status, createdAt)
- `UserQuestionRecord`: userId, questionId, isCorrect, createdAt, (userId, isCorrect), (userId, createdAt)
- `Note`: userId, (userId, importance), isAiGenerated
- `Exam`: userId, status, (userId, status), createdAt
- `ExamQuestion`: examId, questionId, (examId, questionId) unique
- `LoginAttempt`: ip, userId, email, createdAt, (ip, success, createdAt), (success, createdAt)
- `IpBlockRule`: ip, expiresAt

---

## 🚀 技术栈详解

### 前端栈
- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS + PostCSS（`tailwindcss-animate` ESM import）
- **UI 库**: Radix UI (25 个组件)
- **表单**: React Hook Form + Zod
- **状态**: Zustand
- **表格**: TanStack React Table
- **查询**: TanStack React Query
- **日期**: date-fns

### 后端栈
- **运行时**: Node.js
- **框架**: Next.js API Routes
- **ORM**: Prisma 6.1
- **认证**: JWT (jsonwebtoken)
- **加密**: bcryptjs
- **缓存**: Redis (ioredis)
- **邮件**: Nodemailer (邮件配置)

### 部署
- **容器化**: Docker + Docker Compose
- **数据库**: PostgreSQL 16
- **缓存**: Redis 7
- **支持 AI**: OpenAI 兼容 API

---

## 📈 关键功能流程

### 1️⃣ 用户注册激活流程
```
用户注册 → 发送验证邮件 → 验证邮箱 → 输入激活码 → 激活 → 完全激活
```

### 2️⃣ 题目练习流程
```
选择题库 → 选择模式 → 开始练习 → 回答题目 → 查看分析
                                   ├── 查看/编辑笔记（折叠面板，自动加载已有笔记）
                                   ├── AI 解析 / AI 讲解 / 生成相似题
                                   └── 收藏 / 反馈题目
```

### 3️⃣ AI 功能流程
```
用户请求 → 检查日次限制 → 调用 AI API → 记录使用 → 返回结果
```

### 4️⃣ 题库上传审核流程
```
用户下载模板 → 编辑题目 → 上传文件 → 自动解析（5 种题型 + 图片提取） → AI 格式检查 → 预览确认 → 导入题库
```

**模板生成** (`/api/questions/template`):
- Word 模板：使用 JSZip + 手写 OOXML 生成标准 `.docx`，每道题之间用独立段落分隔
- 支持五种题型示例：单选、多选、判断、填空、完形填空
- 同时提供 JSON 和 Excel 格式模板

**上传解析** (`/api/questions/upload`)：
- 使用 mammoth 将 `.docx` 转换为 HTML，再提取纯文本
- 智能题目分块：先按空行分割，再按编号模式（`\d+[.、)）]` / `第\d+题` / `Q\d+:` 等）二次分割
- 避免将完形填空选项行（如 `1. A. xxx|B. yyy`）误判为题目边界
- 自动检测题型：true/false 答案 → 判断题、`__1__` 标记 → 完形填空、下划线/括号 → 填空题、逗号分隔答案 → 多选题
- 支持图片提取（Base64 Data URI）
- 旧版 `.doc` 回退：二进制文本提取（UTF-16LE / Latin-1）

---

## ⚡ 性能优化点

1. **缓存策略 — 全路由 Redis 覆盖**
   - **用户仪表板**: `/api/dashboard` — 15s TTL，答题记录/收藏变更时失效
   - **题库列表**: `/api/questions` — 120s TTL，创建/更新/删除时失效
   - **题库详情**: `/api/questions/[bankId]` — 300s TTL
   - **题库题目列表**: `/api/questions/[bankId]/questions` — 120s TTL，添加/编辑/删除题目时失效
   - **管理员仪表板**: `/api/admin/dashboard` — 60s TTL（stats + charts 独立缓存）
   - **用户管理**: `/api/admin/users` — 15s TTL
   - **题库审核**: `/api/admin/questions` — 30s TTL
   - **反馈管理**: `/api/admin/reports` — 30s TTL，处理反馈时失效
   - **审核绩效**: `/api/admin/reviewer-stats` — 60s TTL
   - **风控概览**: `/api/admin/risk-control/overview` — 30s TTL
   - **风控 IP 分析**: `/api/admin/risk-control/ips` — 30s TTL，封禁/解封时失效
   - **登录尝试记录**: `/api/admin/risk-control/attempts` — 30s TTL
   - **系统配置**: `/api/admin/settings` — 300s TTL，更新配置时失效
   - **审核模板**: `/api/admin/review-templates` — 120s TTL，创建/更新/删除时失效
   - **操作日志**: `/api/admin/logs` — 30s TTL（操作类型列表独立缓存 300s）
   - **SystemConfig**: Redis 缓存 (TTL 300s) + 内存 Map 缓存 (30s)
   - **AI 使用量统计**: Redis 存储，日末自动过期
   - **AI 响应缓存**: 数据库存储，SHA256 哈希索引，30 天过期，相同提示词命中即返回
   - **缓存失效**: 使用 SCAN + 批量 DEL 实现非阻塞模式匹配失效

2. **数据库索引**
   - User 表: email, username, role, banned, isActivated, emailVerified, createdAt
   - QuestionBank: status, category, difficulty, isPublic, uploaderId, reviewedById, createdAt, (status, createdAt)
   - UserQuestionRecord: userId, questionId, isCorrect, createdAt, (userId, isCorrect), (userId, createdAt)
    - Note: userId, (userId, importance), isAiGenerated
    - Exam: userId, status, (userId, status), createdAt
    - LoginAttempt: ip, userId, email, createdAt, (ip, success, createdAt), (success, createdAt)
    - IpBlockRule: ip, expiresAt
    - ActivationCode: code, batchId, status, isUsed, expiresAt
   - UserSession: userId, token, lastPingAt, isActive

3. **查询优化**
   - 使用 `_count` 替代 `include: { questions: { select: { id: true } } }` 避免 N+1
   - 统计类查询使用 `Promise.all` 并行执行
   - 聚合查询使用 Prisma `aggregate` 和 `$queryRawUnsafe` 优化
   - 管理员仪表板拖码查询使用 `$queryRaw` + `DATE()` 正确分组
   - Prisma 连接池 `connection_limit=20`，支持高并发查询
   - 操作日志的 `distinct actions` 查询独立缓存，避免每次翻页重新计算

4. **Redis 优化**
   - 即连模式（`lazyConnect: false`），消除首次 API 调用时的 3-4s 冷启动延迟
   - TCP Keep-Alive 30s（`keepAlive: 30000`），保持长连接，减少 TCP 握手开销
   - 连接超时 5s（`connectTimeout: 5000`）+ 命令超时 5s（`commandTimeout: 5000`）
   - 重试策略：最多 5 次，间隔 150ms~1500ms（生产环境 maxRetriesPerRequest=2）
   - 离线队列开启（`enableOfflineQueue: true`），命令在连接就绪前排队，防止竞态报错
   - `reconnectOnError` 处理 READONLY 故障转移
   - 缓存失效使用 `Pipeline` + `UNLINK` 非阻塞批量删除，替代 `SCAN` + 逐个 `DEL`
   - 容器端：`--tcp-keepalive 60`、`--tcp-backlog 511`、`--save ""`（仅 AOF，避免 RDB 双重写入）、`--databases 1`
   - Prisma 连接池 `connection_limit=15` + `pool_timeout=10s`
   - PostgreSQL: `shared_buffers=256MB`、`effective_cache_size=768MB`、`random_page_cost=1.1`（SSD）、`effective_io_concurrency=200`

5. **前端优化**
   - 根布局 `<Suspense>` 包裹 + `LoadingScreen` 全屏加载动画（Brain 图标浮动 + 脉冲光环 + 渐变进度条 + 跳动圆点指示器）
   - 所有页面路由配有 `loading.tsx` 骨架屏（SSR 流式加载），包括管理员所有页面和用户仪表板
   - 仪表板/管理后台 `mounted` 检查时展示 `LoadingScreen` 替代 `return null` 空白闪烁
   - `LoadingOverlay` 组件支持区域级半透明加载覆盖（带模糊背景）
   - 邮箱验证页 Suspense 回退升级为 `PageLoading`
   - React Query 状态管理（5min gcTime / 30s staleTime）
   - API 分页查询支持
   - 速率限制设置（Redis 滑动窗口算法）
   - 自定义 CSS 动画：`float`、`ping-slow`、`spin-slow`、`bounce-dot`（Tailwind 注册）

---

## 🔒 安全性措施

1. **认证**
   - JWT Token (7天有效期)
   - Cookie + Bearer Token 支持
   - SessionId 追踪
   - **用户存在性校验**（数据库重建后旧 token 自动失效）

2. **授权**
   - Role-based Access Control (RBAC)
   - 3 级权限: USER, ADMIN, SUPER_ADMIN

3. **数据防护**
   - bcryptjs 密码加密
   - SQL 注入防护 (Prisma ORM)
   - CORS 配置

4. **风控**
   - IP 登录速率限制（滑动窗口算法）
   - 登录尝试全量记录（IP、邮箱、成功/失败、原因、UserAgent）
   - IP 风险等级评估（正常/低/中/高）
   - IP 封禁/解封管理（Redis + DB 双重封禁，支持定时过期）
   - 注册限制（IP/设备/邮箱域名多维度）

5. **审计**
   - 完整的操作日志
   - IP 和 User-Agent 记录
   - 用户激活与禁用追踪

---

## 📱 响应式与无障碍

- **UI 框架**: Radix UI 提供 WCAG 无障碍支持
- **样式**: Tailwind CSS 响应式设计
- **主题**: 亮色/暗色模式支持
- **布局**: 移动端适配

---

## 🔄 WebSocket 功能

**端点**: `/api/ws/`

- **实时通知**: 题目上传反馈
- **在线状态**: 用户在线检测
- **消息推送**: 考试计时、通知

---

## 📧 邮件功能

**支持**: SMTP 邮件服务

- 用户注册验证
- 密码重置邮件
- 题库审核通知
- 系统公告

---

## ✅ 项目完成度评估

| 功能模块 | 完成度 | 备注 |
|---------|--------|------|
| 用户认证 | ✅ 100% | 支持注册、登录、激活，含用户存在性校验 |
| 题库管理 | ✅ 100% | 支持上传（含 .doc/.xls）、AI 分析、审核、查询 |
| 题目练习 | ✅ 100% | 支持多种模式和类型 |
| AI 功能 | ✅ 100% | 可配置多个 AI 提供商，分维度限流 |
| 学习分析 | ✅ 100% | 统计看板、AI 薄弱点、时间趋势、错题库 |
| 模拟考试 | ✅ 100% | 试卷生成、定时考试、评分排名 |
| 笔记系统 | ✅ 100% | 重要性标记、AI 总结、搜索导出、内联编辑、刷题时边答边记 |
| 管理后台 | ✅ 100% | 完整的数据管理界面 |
| 登录风控 | ✅ 100% | IP 风险评级、登录记录、封禁管理、可视化看板 |
| 审核工作流 | ✅ 100% | 5 种状态流转、绩效统计 |
| 用户反馈 | ✅ 100% | 提交反馈、管理员处理（已处理/驳回） |
| AI 缓存 | ✅ 100% | SHA256 哈希缓存、30 天过期、节省 Token |
| 权限控制 | ✅ 100% | RBAC 完善 |
| 日志系统 | ✅ 100% | 审计日志记录完整 |
| 邮件服务 | ✅ 100% | SMTP 集成 |
| WebSocket | ✅ 100% | 实时通信支持 |

---

## 🎯 总结

**NovaMind** 是一个功能完整、架构清晰的现代化在线教育平台。它采用了：

✨ **现代技术栈** - Next.js 15, TypeScript, React 19  
🏗️ **清晰的项目结构** - 路由分组、模块化设计  
🔐 **完善的安全体系** - JWT认证、RBAC权限、审计日志  
🤖 **AI 集成能力** - 支持 14 个 AI 提供商、题目评估和生成、分维度限流  
📊 **数据驱动** - 学习分析看板、时间趋势图表、知识点覆盖率  
📝 **模拟考试** - 试卷生成、定时考试、自动批改、成绩排名  
📦 **企业级特性** - Redis 多级缓存、Pipeline+UNLINK 非阻塞失效、速率限制、错误处理、日志记录  
🎨 **现代 UI/UX** - Radix UI + Tailwind CSS + Recharts、响应式设计、优雅全屏加载动画（浮动图标 + 脉冲光环 + 渐变进度条）、骨架屏流式加载  
⚡ **极致加载体验** - Redis Keep-Alive 长连接、Pipeline 批量操作、PostgreSQL SSD 优化、连接池调优、全局 `<Suspense>` 加载屏幕、路由级骨架屏

该项目可用于教育机构、在线考试平台或企业培训系统，具有良好的可扩展性和维护性。

---

**生成者**: AI 项目分析系统  
**分析精度**: 基于源代码直接检查  
**推荐阅读顺序**: 项目概览 → API 路由 → 核心业务逻辑 → 页面结构 → 状态管理 → 数据库模型
