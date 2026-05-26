"use client"

import { useEffect, useState } from "react"
import { Brain } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingScreenProps {
  fullScreen?: boolean
  message?: string
}

export function LoadingScreen({
  fullScreen = true,
  message = "加载中...",
}: LoadingScreenProps) {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(showTimer)
  }, [])

  useEffect(() => {
    if (!visible) return
    const duration = 1800
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setProgress(Math.min(eased * 90, 90))
      if (t < 1) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  }, [visible])

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-background transition-opacity duration-300",
        fullScreen ? "fixed inset-0 z-[9999]" : "min-h-[400px] w-full",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="relative flex flex-col items-center gap-8">
        <div className="relative">
          <div className="absolute inset-0 animate-ping-slow rounded-full bg-primary/20 blur-xl" />
          <div className="absolute -inset-2 animate-pulse rounded-full bg-primary/10 blur-lg" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent ring-1 ring-primary/20 backdrop-blur-sm">
            <Brain className="h-10 w-10 text-primary animate-float" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <span className="text-lg font-semibold tracking-wide text-foreground">
            NovaMind
          </span>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">{message}</span>
            <span className="flex gap-0.5 pt-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1 w-1 rounded-full bg-primary animate-bounce-dot"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          </div>
        </div>

        <div className="h-0.5 w-48 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 transition-[width] duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function LoadingOverlay({ message }: { message?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div
      className={cn(
        "absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm transition-all duration-300",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 animate-ping-slow rounded-full bg-primary/15 blur-md" />
          <Brain className="relative h-8 w-8 animate-spin-slow text-primary" />
        </div>
        {message && (
          <span className="text-sm text-muted-foreground">{message}</span>
        )}
      </div>
    </div>
  )
}

export function PageLoading() {
  return <LoadingScreen fullScreen={false} message="正在加载页面" />
}
