import nodemailer from "nodemailer";
import { prisma } from "./prisma";

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter | null> {
  if (transporter) return transporter;

  const [host, port, user, pass, from] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: "smtp_host" } }),
    prisma.systemConfig.findUnique({ where: { key: "smtp_port" } }),
    prisma.systemConfig.findUnique({ where: { key: "smtp_user" } }),
    prisma.systemConfig.findUnique({ where: { key: "smtp_pass" } }),
    prisma.systemConfig.findUnique({ where: { key: "smtp_from" } }),
  ]);

  if (!host?.value || !user?.value) return null;

  transporter = nodemailer.createTransport({
    host: host.value,
    port: parseInt(port?.value || "587", 10),
    secure: parseInt(port?.value || "587", 10) === 465,
    auth: {
      user: user.value,
      pass: pass?.value || "",
    },
  });

  return transporter;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const transport = await getTransporter();
    if (!transport) {
      console.log("[EMAIL] No SMTP configured, skipping email to:", options.to);
      return false;
    }

    const fromConfig = await prisma.systemConfig.findUnique({
      where: { key: "smtp_from" },
    });

    await transport.sendMail({
      from: fromConfig?.value || "NovaMind <noreply@novamind.com>",
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    return true;
  } catch (error) {
    console.error("[EMAIL] Failed to send email:", error);
    return false;
  }
}

export async function sendVerificationEmail(
  to: string,
  code: string
): Promise<boolean> {
  return await sendMail({
    to,
    subject: "NovaMind - 邮箱验证码",
    html: `
      <div style="max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif;">
        <h2 style="color:#6366f1;">NovaMind 邮箱验证</h2>
        <p>您的验证码是：</p>
        <div style="background:#f3f4f6;padding:20px;text-align:center;border-radius:8px;margin:20px 0;">
          <span style="font-size:32px;font-weight:bold;color:#6366f1;letter-spacing:8px;">${code}</span>
        </div>
        <p style="color:#6b7280;">验证码 10 分钟内有效，请勿泄露给他人。</p>
      </div>
    `,
  });
}

export async function sendActivationCodeEmail(
  to: string,
  code: string
): Promise<void> {
  await sendMail({
    to,
    subject: "NovaMind - 您的激活码",
    html: `
      <div style="max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif;">
        <h2 style="color:#6366f1;">NovaMind 激活码</h2>
        <p>感谢您的购买！您的激活码如下：</p>
        <div style="background:#f3f4f6;padding:20px;text-align:center;border-radius:8px;margin:20px 0;">
          <span style="font-size:28px;font-weight:bold;color:#6366f1;">${code}</span>
        </div>
        <p>请在 NovaMind 个人中心使用此激活码激活您的账号。</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string
): Promise<void> {
  await sendMail({
    to,
    subject: "NovaMind - 重置密码",
    html: `
      <div style="max-width:600px;margin:0 auto;padding:20px;font-family:Arial,sans-serif;">
        <h2 style="color:#6366f1;">NovaMind 密码重置</h2>
        <p>您正在请求重置密码，请点击下方链接：</p>
        <a href="${resetLink}" 
           style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin:20px 0;">
          重置密码
        </a>
        <p style="color:#6b7280;">此链接 30 分钟内有效。如非本人操作，请忽略此邮件。</p>
      </div>
    `,
  });
}
