import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getImageDir, getImageMime } from "@/lib/storage";

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * 静态图片服务：/api/uploads/images/<uuid>.<ext>
 *
 * - 文件名为服务端生成的随机 UUID，不可枚举猜测；
 * - 严格限制在图片目录内，拒绝任何形式的路径穿越；
 * - 内容不可变（文件名含 UUID），设置一年长缓存。
 */
export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { path: segments } = await context.params;

    const relative = segments.map((s) => decodeURIComponent(s)).join("/");
    const resolved = path.resolve(getImageDir(), relative);
    const root = path.resolve(getImageDir());
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      return new Response("Not found", { status: 404 });
    }

    const mime = getImageMime(path.extname(resolved));
    if (!mime) {
      return new Response("Not found", { status: 404 });
    }

    const data = await fs.readFile(resolved);

    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
