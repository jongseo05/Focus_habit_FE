"use client"

import type React from "react"

import { useState, useEffect, Suspense } from "react"
import { motion } from "framer-motion"
import { Brain, Mail, CheckCircle, AlertCircle, Sparkles, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { supabaseBrowser } from "@/lib/supabase/client"
import LoadingPage from "../../loading/page"

function EmailConfirmForm() {
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [error, setError] = useState("")
  const [countdown, setCountdown] = useState(5)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        // URL에서 토큰과 타입 파라미터 추출
        const token = searchParams.get('token')
        const type = searchParams.get('type')

        if (!token) {
          setError("인증 토큰이 없습니다. 이메일을 다시 확인해주세요.")
          setIsLoading(false)
          return
        }

        // Supabase 이메일 확인 처리
        const supabase = supabaseBrowser()
        
        if (type === 'recovery') {
          // 비밀번호 재설정 토큰 확인
          const { error: recoveryError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'recovery'
          })
          
          if (recoveryError) {
            setError("비밀번호 재설정 링크가 유효하지 않습니다. 다시 시도해주세요.")
            setIsLoading(false)
            return
          }
          
          // 비밀번호 재설정 페이지로 리다이렉트
          router.push('/auth/reset-password')
          return
        } else {
          // 이메일 확인 토큰 확인
          const { error: confirmError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'signup'
          })
          
          if (confirmError) {
            setError("이메일 확인 링크가 유효하지 않습니다. 다시 시도해주세요.")
            setIsLoading(false)
            return
          }
        }

        // 이메일 확인 성공
        setIsConfirmed(true)
        setIsLoading(false)
        
        // 5초 후 로그인 페이지로 리다이렉트
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer)
              router.push('/login')
            }
            return prev - 1
          })
        }, 1000)

        return () => clearInterval(timer)
      } catch (err) {
        setError("이메일 확인 중 오류가 발생했습니다. 다시 시도해주세요.")
        setIsLoading(false)
      }
    }

    confirmEmail()
  }, [searchParams, router])

  const handleManualRedirect = () => {
    router.push('/login')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex items-center justify-center p-6">
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="space-y-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">이메일 확인 중...</h2>
                <p className="text-slate-600">잠시만 기다려주세요.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        {/* Floating Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute top-20 left-20 w-32 h-32 bg-red-100 rounded-full opacity-20"
            style={{
              animation: "gentleFloat 6s ease-in-out infinite",
              animationDelay: "0s",
            }}
          ></div>
          <div
            className="absolute bottom-20 right-20 w-24 h-24 bg-red-50 rounded-full opacity-30"
            style={{
              animation: "gentleFloat 6s ease-in-out infinite",
              animationDelay: "2s",
            }}
          ></div>
        </div>

        <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
          <div className="w-full max-w-md">
            {/* Header */}
            <motion.div
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="text-center mb-8"
            >
              <Link href="/" className="inline-flex items-center gap-3 mb-8 group">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                  <Brain className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-slate-900">FocusAI</span>
              </Link>

              <div className="space-y-3">
                <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 mb-4">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  인증 오류
                </Badge>
                <h1 className="text-4xl font-bold text-slate-900 leading-tight">
                  이메일{" "}
                  <span className="bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">
                    확인 실패
                  </span>
                </h1>
                <p className="text-xl text-slate-600 leading-relaxed">인증 과정에서 문제가 발생했습니다</p>
              </div>
            </motion.div>

            {/* Error Card */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
                <CardContent className="p-8">
                  <div className="text-center space-y-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">인증 실패</h3>
                      <p className="text-slate-600 mb-4">{error}</p>
                    </div>

                    <div className="space-y-3">
                      <Button
                        onClick={() => router.push('/signup')}
                        className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl"
                      >
                        회원가입 다시 하기
                      </Button>
                      
                      <Button
                        variant="outline"
                        onClick={() => router.push('/login')}
                        className="w-full h-12 border-slate-200 rounded-xl hover:bg-slate-50"
                      >
                        로그인 페이지로
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>

        {/* Custom Styles */}
        <style jsx>{`
          @keyframes gentleFloat {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-10px);
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-20 left-20 w-32 h-32 bg-green-100 rounded-full opacity-20"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "0s",
          }}
        ></div>
        <div
          className="absolute bottom-20 right-20 w-24 h-24 bg-emerald-100 rounded-full opacity-30"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "2s",
          }}
        ></div>
        <div
          className="absolute top-1/2 left-10 w-16 h-16 bg-teal-100 rounded-full opacity-25"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "4s",
          }}
        ></div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <motion.div
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-center mb-8"
          >
            <Link href="/" className="inline-flex items-center gap-3 mb-8 group">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-slate-900">FocusAI</span>
            </Link>

            <div className="space-y-3">
              <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 mb-4">
                <Sparkles className="w-3 h-3 mr-1" />
                이메일 확인
              </Badge>
              <h1 className="text-4xl font-bold text-slate-900 leading-tight">
                이메일{" "}
                <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  확인 완료
                </span>
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed">축하합니다! 계정이 성공적으로 활성화되었습니다</p>
            </div>
          </motion.div>

          {/* Success Card */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-8">
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">인증 성공!</h3>
                    <p className="text-slate-600">
                      이제 FocusAI의 모든 기능을 사용할 수 있습니다.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={handleManualRedirect}
                      className="w-full h-12 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-medium rounded-xl"
                    >
                      <div className="flex items-center gap-2">
                        로그인하기
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </Button>
                    
                    <p className="text-sm text-slate-500">
                      {countdown}초 후 자동으로 로그인 페이지로 이동합니다
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-center mt-8"
          >
            <p className="text-sm text-slate-500">
              문제가 있으시면{" "}
              <Link href="/support" className="text-blue-600 hover:text-blue-700 transition-colors">
                고객지원
              </Link>
              에 문의해주세요.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        @keyframes gentleFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  )
}

export default function EmailConfirmPage() {
  return (
    <Suspense fallback={<LoadingPage />}> 
      <EmailConfirmForm />
    </Suspense>
  )
}
