"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Brain, Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { signIn, signInWithGoogle, signInWithApple } from "@/lib/auth/auth"

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn({
        email: formData.email,
        password: formData.password,
      })

      if (result.success) {
        // 로그인 성공 시 지정된 경로 또는 대시보드로 리다이렉트
        router.push(redirectTo)
      } else {
        // 에러 메시지 표시
        setError(result.error || "로그인에 실패했습니다.")
      }
    } catch (err) {
      setError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithGoogle()
      if (result.success) {
        router.push(redirectTo)
      } else {
        setError(result.error || "Google 로그인에 실패했습니다.")
      }
    } catch (err) {
      setError("Google 로그인 중 오류가 발생했습니다.")
    }
  }

  const handleAppleLogin = async () => {
    try {
      const result = await signInWithApple()
      if (result.success) {
        router.push(redirectTo)
      } else {
        setError(result.error || "Apple 로그인에 실패했습니다.")
      }
    } catch (err) {
      setError("Apple 로그인 중 오류가 발생했습니다.")
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Floating Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-20 left-20 w-32 h-32 bg-blue-100 rounded-full opacity-20"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "0s",
          }}
        ></div>
        <div
          className="absolute bottom-20 right-20 w-24 h-24 bg-indigo-100 rounded-full opacity-30"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "2s",
          }}
        ></div>
        <div
          className="absolute top-1/2 left-10 w-16 h-16 bg-purple-100 rounded-full opacity-25"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "4s",
          }}
        ></div>
        <div
          className="absolute top-1/3 right-16 w-20 h-20 bg-blue-50 rounded-full opacity-40"
          style={{
            animation: "gentleFloat 6s ease-in-out infinite",
            animationDelay: "1s",
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
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 mb-4">
                <Sparkles className="w-3 h-3 mr-1" />
                로그인
              </Badge>
              <h1 className="text-4xl font-bold text-slate-900 leading-tight">
                다시 오신 것을{" "}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  환영합니다
                </span>
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed">집중력 향상 여정을 계속하세요</p>
            </div>
          </motion.div>

          {/* Login Form */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="p-8">
                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700"
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </motion.div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                  {/* Email Field */}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold text-slate-700">
                      이메일 주소
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className="pl-12 h-14 bg-white border-slate-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 text-base"
                        required
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold text-slate-700">
                      비밀번호
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="비밀번호를 입력하세요"
                        value={formData.password}
                        onChange={(e) => handleInputChange("password", e.target.value)}
                        className="pl-12 pr-12 h-14 bg-white border-slate-200 rounded-xl focus:border-blue-500 focus:ring-blue-500/20 transition-all duration-200 text-base"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.rememberMe}
                        onChange={(e) => handleInputChange("rememberMe", e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 focus:ring-2"
                      />
                      <span className="text-sm text-slate-600">로그인 상태 유지</span>
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      비밀번호를 잊으셨나요?
                    </Link>
                  </div>

                  {/* Login Button */}
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        로그인 중...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        로그인
                      </div>
                    )}
                  </Button>
                </form>

                {/* Divider */}
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-slate-500">또는</span>
                  </div>
                </div>

                {/* Social Login */}
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleLogin}
                    className="w-full h-12 border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <Image 
                        src="/google.svg" 
                        alt="Google" 
                        width={20} 
                        height={20}
                        className="w-5 h-5"
                      />
                      Google로 계속하기
                    </div>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAppleLogin}
                    className="w-full h-12 border-slate-200 rounded-xl hover:bg-slate-50 transition-all duration-200 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <Image 
                        src="/apple.svg" 
                        alt="Apple" 
                        width={20} 
                        height={20}
                        className="w-5 h-5"
                      />
                      Apple로 계속하기
                    </div>
                  </Button>
                </div>

                {/* Sign Up Link */}
                <div className="text-center mt-8 pt-6 border-t border-slate-100">
                  <p className="text-slate-600">
                    아직 계정이 없으신가요?{" "}
                    <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                      회원가입
                    </Link>
                  </p>
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
              로그인하면{" "}
              <Link href="/terms" className="text-blue-600 hover:text-blue-700 transition-colors">
                이용약관
              </Link>{" "}
              및{" "}
              <Link href="/privacy" className="text-blue-600 hover:text-blue-700 transition-colors">
                개인정보처리방침
              </Link>
              에 동의하는 것으로 간주됩니다.
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
