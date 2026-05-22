"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import toast from "react-hot-toast"
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
import { Code2, Loader2 } from "lucide-react"

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name || !email || !password || !confirmPassword) {
      toast.error("请填写所有字段")
      return
    }

    if (password !== confirmPassword) {
      toast.error("两次输入的密码不一致")
      return
    }

    if (password.length < 6) {
      toast.error("密码长度至少 6 位")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "注册失败")
      }

      toast.success("注册成功，请登录")
      router.push("/login")
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "注册失败，请稍后重试"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <div className="flex items-center justify-center gap-2">
          <Code2 className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">NovaMind</span>
        </div>
        <CardTitle className="text-2xl">创建账号</CardTitle>
        <CardDescription>
          填写信息注册 NovaMind 账号
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">用户名</Label>
            <Input
              id="name"
              type="text"
              placeholder="输入您的用户名"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="设置登录密码（至少6位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">确认密码</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "注册中..." : "注册"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            已有账号？{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              立即登录
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
