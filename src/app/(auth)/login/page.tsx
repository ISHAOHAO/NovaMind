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

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [account, setAccount] = useState("")
  const [password, setPassword] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!account || !password) {
      toast.error("请填写用户名/邮箱和密码")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.needVerify && data.email) {
          toast.error("请先验证邮箱后再登录")
          router.push(`/verify-email?email=${encodeURIComponent(data.email)}`)
          return
        }
        throw new Error(data.error || "登录失败")
      }

      localStorage.setItem("novamind_token", data.token)
      localStorage.setItem("novamind_user", JSON.stringify(data.user))

      toast.success("登录成功")

      router.push("/dashboard")
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "登录失败，请稍后重试"
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
        <CardTitle className="text-2xl">登录账号</CardTitle>
        <CardDescription>
          输入您的用户名/邮箱和密码登录 NovaMind
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account">用户名 / 邮箱</Label>
            <Input
              id="account"
              type="text"
              placeholder="输入用户名或邮箱"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">密码</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground underline-offset-2 hover:underline"
              >
                忘记密码？
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="输入您的密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "登录中..." : "登录"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            还没有账号？{" "}
            <Link
              href="/register"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              立即注册
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
