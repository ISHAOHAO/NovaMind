"use client"

import { Suspense, useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
import { PageLoading } from "@/components/ui/loading-screen"

function VerifyEmailForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""

  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (!email) {
      router.push("/register")
    }
  }, [email, router])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()

    if (!code || code.trim().length < 6) {
      toast.error("请输入6位验证码")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/auth/verify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: code.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "验证失败")
      }

      toast.success(data.message || "邮箱验证成功，请登录")
      router.push("/login")
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "验证失败，请稍后重试"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResending(true)
    try {
      const res = await fetch("/api/auth/resend-registration-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "发送失败")
      }

      toast.success("验证码已重新发送")
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "发送失败，请稍后重试"
      toast.error(message)
    } finally {
      setResending(false)
    }
  }

  if (!email) return null

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <div className="flex items-center justify-center gap-2">
          <Code2 className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">NovaMind</span>
        </div>
        <CardTitle className="text-2xl">验证邮箱</CardTitle>
        <CardDescription>
          验证码已发送至 {email}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleVerify}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">验证码</Label>
            <Input
              id="code"
              type="text"
              placeholder="请输入6位验证码"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={loading}
              className="text-center text-2xl tracking-widest"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "验证中..." : "验证邮箱"}
          </Button>
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-sm text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
            >
              {resending ? "发送中..." : "重新发送验证码"}
            </button>
            <Link
              href="/login"
              className="text-sm text-primary underline-offset-2 hover:underline"
            >
              返回登录
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <VerifyEmailForm />
    </Suspense>
  )
}
