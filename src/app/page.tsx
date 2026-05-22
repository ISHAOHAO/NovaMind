"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  BookOpen,
  Brain,
  Clock,
  Key,
  ArrowRight,
  Code2,
  Sparkles,
} from "lucide-react"

const features = [
  {
    icon: BookOpen,
    title: "海量题库",
    description:
      "涵盖多种编程语言和技术栈的丰富题目，从初级到高级，满足不同阶段的学习需求。",
  },
  {
    icon: Brain,
    title: "AI 智能解析",
    description:
      "基于 AI 的智能题目解析，深入讲解解题思路，帮助你真正理解每道题目背后的知识点。",
  },
  {
    icon: Clock,
    title: "错题回顾",
    description:
      "自动记录做错的题目，支持错题重做和专项练习，让薄弱环节得到针对性强化。",
  },
  {
    icon: Key,
    title: "激活码系统",
    description:
      "通过激活码解锁平台功能，支持多种套餐方案，灵活满足个人和团队的使用需求。",
  },
]

const highlights = [
  { label: "题目数量", value: "1000+" },
  { label: "活跃用户", value: "5000+" },
  { label: "通过率提升", value: "85%" },
]

export default function HomePage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const token = localStorage.getItem("novamind_token")
    if (token) {
      router.replace("/dashboard")
    }
  }, [router])

  if (!mounted) {
    return null
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Code2 className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">NovaMind</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">登录</Button>
            </Link>
            <Link href="/register">
              <Button>免费注册</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="container flex flex-col items-center justify-center py-20 text-center md:py-28">
          <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium">
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            AI 驱动的智能刷题平台
          </div>
          <h1 className="mt-8 max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl">
            高效刷题
            <span className="text-primary">，智能提升</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            NovaMind
            结合人工智能技术，为你提供个性化的刷题体验。从题目练习到深度解析，
            全方位助力你的编程能力成长。
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="text-base">
                免费体验
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="text-base">
                立即登录
              </Button>
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 md:gap-12">
            {highlights.map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-3xl font-bold text-primary">
                  {item.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="container py-20">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight">
                为什么选择 NovaMind？
              </h2>
              <p className="mt-3 text-muted-foreground">
                我们提供全方位的刷题解决方案
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <Card
                  key={feature.title}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-lg">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="container py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            准备好开始了吗？
          </h2>
          <p className="mt-3 text-muted-foreground">
            注册账号，立即体验 AI 驱动的智能刷题之旅。
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="text-base">
                免费开始使用
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg" className="text-base">
                已有账号？去登录
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container flex flex-col items-center gap-4 py-10 md:flex-row md:justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">NovaMind</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} NovaMind. 保留所有权利。
          </p>
        </div>
      </footer>
    </div>
  )
}
