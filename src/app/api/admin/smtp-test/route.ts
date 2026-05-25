import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { sendMail } from "@/lib/email";

export const POST = requireAdmin(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const testEmail = body.email;

    if (!testEmail || typeof testEmail !== "string" || !testEmail.includes("@")) {
      return Response.json({ error: "请输入有效的测试邮箱" }, { status: 400 });
    }

    const sent = await sendMail({
      to: testEmail,
      subject: "NovaMind - SMTP 测试邮件",
      html: `
        <div style="max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif;">
          <h2 style="color:#6366f1;">NovaMind SMTP 测试</h2>
          <p>这是一封测试邮件，用于验证 SMTP 配置是否正确。</p>
          <p style="color:#6b7280;">发送时间：${new Date().toLocaleString("zh-CN")}</p>
          <p style="color:#22c55e;">如果您收到此邮件，说明 SMTP 配置成功！</p>
        </div>
      `,
    });

    if (!sent) {
      return Response.json({ error: "邮件发送失败，请检查 SMTP 配置" }, { status: 500 });
    }

    return Response.json({ message: "测试邮件已发送，请检查收件箱" });
  } catch (error) {
    console.error("SMTP 测试失败:", error);
    return Response.json({ error: "测试失败" }, { status: 500 });
  }
});
