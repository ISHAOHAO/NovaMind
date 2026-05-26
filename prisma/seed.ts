import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@novamind.com" },
    update: {},
    create: {
      email: "admin@novamind.com",
      password: hashedPassword,
      name: "超级管理员",
      role: "SUPER_ADMIN",
      isActivated: true,
      emailVerified: true,
      activatedAt: new Date(),
    },
  });

  console.log(`✅ 管理员账号: admin@novamind.com / admin123`);

  const systemConfigs = [
    {
      key: "trial_daily_minutes",
      value: "30",
      description: "体验版每日使用时长（分钟）",
    },
    {
      key: "trial_enabled",
      value: "true",
      description: "是否启用体验版",
    },
    {
      key: "activation_required",
      value: "true",
      description: "是否需要激活码才能使用完整版",
    },
    {
      key: "register_enabled",
      value: "true",
      description: "是否开放注册",
    },
    {
      key: "email_verification_required",
      value: "false",
      description: "注册时是否需要邮箱验证",
    },
    {
      key: "register_ip_limit",
      value: "5",
      description: "同一IP每天最多注册次数",
    },
    {
      key: "register_device_limit",
      value: "3",
      description: "同一设备每天最多注册次数",
    },
    {
      key: "global_rate_limit",
      value: "100",
      description: "全局接口每分钟限制",
    },
    {
      key: "ai_provider",
      value: "openai",
      description: "AI 服务商",
    },
    {
      key: "ai_api_key",
      value: "",
      description: "AI API Key",
    },
    {
      key: "ai_model",
      value: "gpt-4o-mini",
      description: "AI 模型",
    },
    {
      key: "ai_base_url",
      value: "https://api.openai.com/v1",
      description: "AI API 地址",
    },
    {
      key: "ai_enabled",
      value: "false",
      description: "是否启用 AI 功能",
    },
    {
      key: "smtp_host",
      value: process.env.SMTP_HOST || "",
      description: "SMTP 服务器",
    },
    {
      key: "smtp_port",
      value: process.env.SMTP_PORT || "587",
      description: "SMTP 端口",
    },
    {
      key: "smtp_user",
      value: process.env.SMTP_USER || "",
      description: "SMTP 用户名",
    },
    {
      key: "smtp_pass",
      value: "",
      description: "SMTP 密码",
    },
    {
      key: "smtp_from",
      value: process.env.SMTP_FROM || "NovaMind <noreply@novamind.com>",
      description: "发件人地址",
    },
    {
      key: "question_review_required",
      value: "true",
      description: "题库是否需要审核",
    },
    {
      key: "site_name",
      value: "NovaMind",
      description: "站点名称",
    },
    {
      key: "site_description",
      value: "高效在线刷题平台",
      description: "站点描述",
    },
    {
      key: "max_session_devices",
      value: "1",
      description: "同一账号最大同时在线设备数（1为单设备登录）",
    },
    {
      key: "ws_heartbeat_interval",
      value: "30",
      description: "WebSocket 心跳间隔（秒）",
    },
    {
      key: "ws_heartbeat_timeout",
      value: "90",
      description: "WebSocket 心跳超时（秒）",
    },
    {
      key: "anti_sharing_enabled",
      value: "true",
      description: "是否启用防账号共享检测",
    },
    {
      key: "abnormal_behavior_threshold",
      value: "50",
      description: "行为异常检测阈值（每分钟操作数）",
    },
  ];

  for (const config of systemConfigs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description },
      create: config,
    });
  }

  console.log(`✅ ${systemConfigs.length} 项系统配置已初始化`);

  const sampleBank = await prisma.questionBank.create({
    data: {
      title: "JavaScript 基础测试",
      description: "包含 JavaScript 基础语法、数据类型、闭包、原型链等核心知识点",
      source: "NovaMind 官方",
      category: "编程语言",
      tags: ["JavaScript", "基础", "前端"],
      difficulty: 2,
      status: "APPROVED",
      isPublic: true,
      uploaderId: admin.id,
    },
  });

  const questions = [
    {
      type: "single",
      content: "JavaScript 中，`typeof null` 的结果是什么？",
      options: JSON.stringify([
        { key: "A", value: "null" },
        { key: "B", value: "undefined" },
        { key: "C", value: "object" },
        { key: "D", value: "boolean" },
      ]),
      answer: "C",
      analysis:
        "这是 JavaScript 的一个历史遗留 Bug。在 JS 最初的实现中，`typeof null` 返回 `object`，这个问题一直保留至今。",
      sortOrder: 1,
    },
    {
      type: "single",
      content: "以下哪个方法会改变原数组？",
      options: JSON.stringify([
        { key: "A", value: "map()" },
        { key: "B", value: "filter()" },
        { key: "C", value: "slice()" },
        { key: "D", value: "splice()" },
      ]),
      answer: "D",
      analysis:
        "`splice()` 方法通过删除或替换现有元素来修改数组，会改变原数组。`map()`、`filter()`、`slice()` 都返回新数组，不改变原数组。",
      sortOrder: 2,
    },
    {
      type: "single",
      content: "以下关于闭包的说法，哪个是正确的？",
      options: JSON.stringify([
        { key: "A", value: "闭包只能访问全局变量" },
        { key: "B", value: "闭包是指函数可以访问其外部作用域中的变量" },
        { key: "C", value: "闭包会导致变量提升" },
        { key: "D", value: "ES6 中已移除闭包特性" },
      ]),
      answer: "B",
      analysis:
        "闭包是指函数能够访问其词法作用域外部变量的能力。即使外部函数已经返回，内部函数仍然可以访问外部函数的变量。",
      sortOrder: 3,
    },
    {
      type: "single",
      content: "`Promise.allSettled()` 与 `Promise.all()` 的主要区别是什么？",
      options: JSON.stringify([
        { key: "A", value: "allSettled 性能更好" },
        {
          key: "B",
          value: "all 会在任意一个 Promise 失败时立即 reject，allSettled 会等待全部完成",
        },
        { key: "C", value: "allSettled 只支持两个参数" },
        { key: "D", value: "两者没有区别" },
      ]),
      answer: "B",
      analysis:
        "`Promise.all()` 只要有一个 Promise reject 就会立即失败；`Promise.allSettled()` 会等待所有 Promise 完成（无论成功或失败），返回每个结果的状态。",
      sortOrder: 4,
    },
    {
      type: "multiple",
      content: "以下哪些是 ES6 新增的特性？（多选）",
      options: JSON.stringify([
        { key: "A", value: "箭头函数" },
        { key: "B", value: "let 和 const" },
        { key: "C", value: "class 关键字" },
        { key: "D", value: "for...in 循环" },
      ]),
      answer: "A,B,C",
      analysis:
        "箭头函数、let/const 块级作用域声明、class 关键字都是 ES6 (ES2015) 新增的。`for...in` 循环在 ES5 及更早版本就已存在。",
      sortOrder: 5,
    },
  ];

  for (const q of questions) {
    await prisma.question.create({
      data: { ...q, bankId: sampleBank.id },
    });
  }

  console.log(
    `✅ 已创建示例题库 "${sampleBank.title}"，包含 ${questions.length} 道题目`
  );

  console.log("\n🎉 数据库初始化完成！");
}

main()
  .catch((e) => {
    console.error("❌ 初始化失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
