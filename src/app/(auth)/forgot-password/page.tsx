"use client"

import { useState } from "react"
import Link from "next/link"
import toast from "react-hot-toast"
import { Mail, Loader2, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!email || !email.includes("@")) {
      toast.error("请输入有效的邮箱地址")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "发送失败")
      }
      setSent(true)
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "发送失败，请稍后重试"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <Card>
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center">
            <MailCheck className="h-10 w-10 text-green-500" />
          </div>
          <CardTitle className="text-2xl">邮件已发送</CardTitle>
          <CardDescription>
            如果该邮箱已注册，重置密码链接已发送至 {email}，请在 30
            分钟内完成重置。若未收到，请检查垃圾邮件或稍后重试。
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-4">
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">返回登录</Link>
          </Button>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            没收到？重新发送
          </button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <div className="flex items-center justify-center gap-2">
          <Mail className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">NovaMind</span>
        </div>
        <CardTitle className="text-2xl">找回密码</CardTitle>
        <CardDescription>
          输入注册邮箱，我们将向您发送密码重置链接
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">注册邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "发送中..." : "发送重置链接"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            想起密码了？{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              返回登录
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
