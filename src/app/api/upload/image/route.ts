import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import sharp from "sharp";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 80;

const VALID_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
};

function validateMagicBytes(buffer: Buffer, declaredType: string): boolean {
  const expected = MAGIC_BYTES[declaredType];
  if (!expected) return false;

  // Also check for common harmful file signatures
  const disallowedSignatures = [
    [0x4d, 0x5a], // EXE/DLL (MZ header)
    [0x7f, 0x45, 0x4c, 0x46], // ELF
    [0x25, 0x50, 0x44, 0x46], // PDF (disallow for image upload)
    [0x50, 0x4b, 0x03, 0x04], // ZIP/DOCX
  ];

  for (const sig of disallowedSignatures) {
    if (sig.every((byte, i) => buffer[i] === byte)) {
      return false; // Blocked file type
    }
  }

  return expected.every((byte, i) => buffer[i] === byte);
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticateRequest(req);
    if (!user) {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "请选择图片文件" }, { status: 400 });
    }

    const mimeType = file.type;
    if (!VALID_MIME_TYPES.includes(mimeType)) {
      return Response.json({
        error: `不支持的图片格式，仅支持: ${VALID_MIME_TYPES.join(", ")}`,
      }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "图片大小不能超过 10MB" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!validateMagicBytes(buffer, mimeType)) {
      return Response.json({ error: "文件签名验证失败，可能是损坏或不安全的文件" }, { status: 400 });
    }

    // Compress and resize with sharp
    let compressed: Buffer;
    try {
      let pipeline = sharp(buffer);

      const metadata = await pipeline.metadata();
      const format = metadata.format;

      // Resize if too large
      if ((metadata.width && metadata.width > MAX_WIDTH) || (metadata.height && metadata.height > MAX_HEIGHT)) {
        pipeline = pipeline.resize(MAX_WIDTH, MAX_HEIGHT, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }

      // Convert to JPEG for consistency and smaller size
      if (format === "png" || format === "webp") {
        // Remove alpha channel for JPEG, but keep it for PNG/WebP if needed
        compressed = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer();
      } else {
        compressed = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer();
      }

      // Verify compressed size is reasonable
      if (compressed.length > 5 * 1024 * 1024) {
        // Still too large, try more aggressive compression
        compressed = await sharp(buffer)
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 60 })
          .toBuffer();
      }
    } catch {
      return Response.json({ error: "图片处理失败，请确认文件是否为有效图片" }, { status: 400 });
    }

    const base64 = compressed.toString("base64");
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    return Response.json({
      success: true,
      data: {
        url: dataUrl,
        size: compressed.length,
        originalSize: file.size,
        mimeType: "image/jpeg",
      },
    });
  } catch (error) {
    console.error("图片上传失败:", error);
    return Response.json({ error: "图片上传失败" }, { status: 500 });
  }
}
