import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * 本地文件存储：题目/头像等图片以文件形式落盘，数据库只存 URL。
 *
 * - 默认目录：<cwd>/data/uploads（Docker 部署中 /app/data 为持久卷，
 *   因此镜像重建不丢文件）；可通过 UPLOAD_DIR 环境变量覆盖。
 * - 通过 /api/uploads/[...path] 路由对外提供，文件名为随机 UUID，不可枚举。
 * - 历史 data URL 仍可正常显示，新写入一律走文件存储。
 */

const IMAGE_DIR = path.join(getUploadRoot(), "images");
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 解码后上限 5MB

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime])
);

function getUploadRoot(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");
}

/** 供文件服务路由使用的图片目录绝对路径 */
export function getImageDir(): string {
  return IMAGE_DIR;
}

/**
 * 将 data URL 图片转存为文件，返回可访问的 URL（/api/uploads/images/xx.jpg）。
 * 非法/失败时返回 null，调用方回退为保留原值或丢弃。
 */
export async function saveImageFromDataUrl(dataUrl: string): Promise<string | null> {
  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;

  return saveImageBuffer(buffer, mime);
}

/** 将图片 Buffer 写入存储，返回可访问的 URL */
export async function saveImageBuffer(buffer: Buffer, mime: string): Promise<string | null> {
  const ext = MIME_TO_EXT[mime.toLowerCase()];
  if (!ext) return null;
  // 防御纵深：无论来源如何，单文件不超过 5MB
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;

  const fileName = `${randomUUID()}.${ext}`;
  await fs.mkdir(IMAGE_DIR, { recursive: true });
  await fs.writeFile(path.join(IMAGE_DIR, fileName), buffer);

  return `/api/uploads/images/${fileName}`;
}

/** 根据文件扩展名返回 MIME 类型（仅图片白名单） */
export function getImageMime(ext: string): string | null {
  return EXT_TO_MIME[ext.toLowerCase().replace(/^\./, "")] || null;
}
