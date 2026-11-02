import type { Metadata } from "next";
import prisma from "@/lib/prisma";

interface Props {
  children: React.ReactNode;
  params: Promise<{ bankId: string }>;
}

/** 题库详情页为客户端组件，由本服务端 layout 提供标题/描述等元数据，利于分享与搜索引擎抓取 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { bankId } = await params;

  try {
    const bank = await prisma.questionBank.findUnique({
      where: { id: bankId },
      select: { title: true, description: true, isPublic: true, status: true },
    });

    if (!bank || (!bank.isPublic && bank.status !== "APPROVED")) {
      return { title: "题库详情" };
    }

    return {
      title: bank.title,
      description:
        bank.description?.slice(0, 160) || `《${bank.title}》在线题库练习`,
      openGraph: {
        title: `${bank.title} | NovaMind`,
        description:
          bank.description?.slice(0, 160) || `《${bank.title}》在线题库练习`,
      },
    };
  } catch {
    return { title: "题库详情" };
  }
}

export default function QuestionBankLayout({ children }: Props) {
  return children;
}
