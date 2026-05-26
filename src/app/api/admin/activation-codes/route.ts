import { NextRequest } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateActivationCodesSchema } from "@/lib/validations";
import { batchDeleteActivationCodesSchema } from "@/lib/validations";
import { Prisma } from "@prisma/client";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateSegment(length: number): string {
  const bytes = crypto.randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS[bytes[i] % CODE_CHARS.length];
  }
  return result;
}

function generateCode(): string {
  return `${generateSegment(5)}-${generateSegment(5)}-${generateSegment(5)}-${generateSegment(5)}`;
}

export const GET = requireAdmin(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || undefined;
    const batchId = searchParams.get("batchId") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.ActivationCodeWhereInput = {};

    if (search) {
      where.code = { contains: search, mode: "insensitive" };
    }
    if (status) {
      where.status = status as any;
    }
    if (batchId) {
      where.batchId = batchId;
    }

    const [codes, total] = await Promise.all([
      prisma.activationCode.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          code: true,
          prefix: true,
          batchId: true,
          duration: true,
          isUsed: true,
          status: true,
          usedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          usedBy: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.activationCode.count({ where }),
    ]);

    return Response.json({
      codes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("获取激活码列表失败:", error);
    return Response.json({ error: "获取激活码列表失败" }, { status: 500 });
  }
});

export const POST = requireAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json();

    const parsed = generateActivationCodesSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message).join("; ");
      return Response.json({ error: errors }, { status: 400 });
    }

    const { prefix, count, duration } = parsed.data;
    const batchId = crypto.randomUUID();
    const expiresAt = duration > 0
      ? new Date(Date.now() + duration * 24 * 60 * 60 * 1000)
      : null;

    const codes: { code: string; prefix: string; batchId: string; duration: number; expiresAt: Date | null }[] = [];

    for (let i = 0; i < count; i++) {
      codes.push({
        code: generateCode(),
        prefix,
        batchId,
        duration,
        expiresAt,
      });
    }

    await prisma.activationCode.createMany({
      data: codes.map((c) => ({
        code: c.code,
        prefix: c.prefix,
        batchId: c.batchId,
        duration: c.duration,
        expiresAt: c.expiresAt,
      })),
    });

    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.userId || null,
        action: "GENERATE_CODES",
        details: `生成 ${count} 个激活码, 批次: ${batchId}, 有效期: ${duration} 天`,
        ip: (req as any).clientIp || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    return Response.json({
      message: `成功生成 ${count} 个激活码`,
      batchId,
      count,
      prefix,
      duration,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "请求格式错误" }, { status: 400 });
    }
    console.error("生成激活码失败:", error);
    return Response.json({ error: "生成激活码失败" }, { status: 500 });
  }
});

export const DELETE = requireAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json();

    const parsed = batchDeleteActivationCodesSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message).join("; ");
      return Response.json({ error: errors }, { status: 400 });
    }

    const { ids } = parsed.data;

    const result = await prisma.activationCode.deleteMany({
      where: { id: { in: ids } },
    });

    await prisma.auditLog.create({
      data: {
        userId: (req as any).user?.userId || null,
        action: "DELETE_CODES",
        details: `批量删除 ${result.count} 个激活码`,
        ip: (req as any).clientIp || null,
        userAgent: req.headers.get("user-agent") || null,
      },
    });

    return Response.json({
      message: `成功删除 ${result.count} 个激活码`,
      deleted: result.count,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "请求格式错误" }, { status: 400 });
    }
    console.error("删除激活码失败:", error);
    return Response.json({ error: "删除激活码失败" }, { status: 500 });
  }
});
