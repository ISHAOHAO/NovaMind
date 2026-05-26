import { z } from "zod";

export const registerSchema = z.object({
  email: z
    .string()
    .email("请输入有效的邮箱地址")
    .min(1, "邮箱不能为空"),
  username: z
    .string()
    .min(2, "用户名至少 2 个字符")
    .max(30, "用户名最多 30 个字符")
    .regex(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, "用户名只能包含中英文、数字和下划线"),
  password: z
    .string()
    .min(6, "密码至少 6 位")
    .max(100, "密码过长"),
  name: z
    .string()
    .min(1, "昵称不能为空")
    .max(50, "昵称最多 50 个字符"),
});

export const loginSchema = z.object({
  account: z.string().min(1, "请输入用户名或邮箱"),
  password: z.string().min(1, "密码不能为空"),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "请输入旧密码"),
  newPassword: z.string().min(6, "新密码至少 6 位"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "两次密码输入不一致",
  path: ["confirmPassword"],
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, "昵称不能为空").max(50, "昵称最多 50 个字符"),
  avatar: z.string().optional(),
});

export const questionBankSchema = z.object({
  title: z.string().min(1, "题库名称不能为空").max(200),
  description: z.string().max(2000).optional(),
  source: z.string().min(1, "请填写题库来源说明").max(500),
  category: z.string().min(1, "请选择分类").max(50),
  tags: z.array(z.string()).default([]),
  difficulty: z.number().min(1).max(5).default(1),
  isPublic: z.boolean().default(false),
});

export const questionSchema = z.object({
  type: z.enum(["single", "multiple", "truefalse", "fillblank", "cloze"]),
  content: z.string().min(1, "题目内容不能为空"),
  options: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    })
  ).optional(),
  answer: z.string().min(1, "答案不能为空"),
  analysis: z.string().optional(),
  image: z.string().optional(),
  sortOrder: z.number().default(0),
});

export const generateActivationCodesSchema = z.object({
  prefix: z.string().max(10).default("NOVA"),
  count: z.number().min(1).max(1000),
  duration: z.number().min(1),
});

export const batchDeleteActivationCodesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export const systemConfigSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

export const banUserSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().min(1, "请填写封禁原因").max(500),
});

export const reviewQuestionSchema = z.object({
  bankId: z.string().min(1),
  status: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().max(500).optional(),
});

export const askAiSchema = z.object({
  questionId: z.string().min(1),
  action: z.enum(["analyze", "similar", "explain"]),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type QuestionBankInput = z.infer<typeof questionBankSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type GenerateCodesInput = z.infer<typeof generateActivationCodesSchema>;
export type ReviewQuestionInput = z.infer<typeof reviewQuestionSchema>;
export type AskAiInput = z.infer<typeof askAiSchema>;
