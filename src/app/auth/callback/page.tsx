"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/client"
import { Brain } from "lucide-react"

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleAuthCallback = async () => {
      const supabase = supabaseBrowser()
      
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error("Auth callback error:", error)
          router.push("/login?error=auth_callback_failed")
          return
        }

        if (data.session) {
          // 로그인 성공 시 대시보드로 리다이렉트
          router.push("/dashboard")
        } else {
          // 세션이 없으면 로그인 페이지로
          router.push("/login")
        }
      } catch (err) {
        console.error("Unexpected error during auth callback:", err)
        router.push("/login?error=unexpected_error")
      }
    }

    handleAuthCallback()
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center mx-auto shadow-lg animate-pulse">
          <Brain className="w-8 h-8 text-white" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">로그인 처리 중...</h2>
          <p className="text-slate-600">잠시만 기다려주세요.</p>
        </div>
        <div className="flex justify-center">
          <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      </div>
    </div>
  )
}