"use client"

import { Suspense, useState, useEffect, useRef } from "react"
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
import { persistSession } from "@/lib/auth-client"

const RESEND_COOLDOWN = 60

function VerifyEmailForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const redirect = searchParams.get("redirect") || ""

  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!email) {
      router.push("/register")
    }
  }, [email, router])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startCooldown() {
    setCooldown(RESEND_COOLDOWN)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  function goAfterLogin() {
    const safeRedirect =
      redirect && redirect.startsWith("/") && !redirect.startsWith("//")
        ? redirect
        : "/dashboard"
    router.push(safeRedirect)
  }

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

      // 服务端验证成功后直接签发会话，自动登录进入工作台
      if (data.token && data.user) {
        persistSession(data.token, data.user)
        toast.success("邮箱验证成功，即将进入 NovaMind")
        goAfterLogin()
      } else {
        toast.success(data.message || "邮箱验证成功，请登录")
        router.push("/login")
      }
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
      startCooldown()
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
              inputMode="numeric"
              placeholder="请输入6位验证码"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={loading}
              className="text-center text-2xl tracking-widest"
              autoComplete="one-time-code"
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
              disabled={resending || cooldown > 0}
              className="text-sm text-muted-foreground underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              {cooldown > 0
                ? `${cooldown}s 后可重新发送`
                : resending
                  ? "发送中..."
                  : "重新发送验证码"}
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
